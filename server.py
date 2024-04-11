from flask import Flask, jsonify, request, redirect, render_template, url_for, session
from flask_cors import CORS
import psycopg2
from psycopg2 import OperationalError
import pandas as pd
from flask_dynamo import Dynamo

from flask_cognito_lib import CognitoAuth
from flask_cognito_lib.decorators import (
    auth_required,
    cognito_login,
    cognito_login_callback,
    cognito_logout,
)
from dotenv import load_dotenv
import os
load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['AWS_REGION'] = os.environ.get('AWS_REGION')
app.config['AWS_COGNITO_DOMAIN'] = os.environ.get('AWS_COGNITO_DOMAIN')
app.config['AWS_COGNITO_USER_POOL_ID'] = os.environ.get('AWS_COGNITO_USER_POOL_ID')
app.config['AWS_COGNITO_USER_POOL_CLIENT_ID'] = os.environ.get('AWS_COGNITO_USER_POOL_CLIENT_ID')
app.config['AWS_COGNITO_USER_POOL_CLIENT_SECRET'] = os.environ.get('AWS_COGNITO_USER_POOL_CLIENT_SECRET')
app.config['AWS_COGNITO_REDIRECT_URL'] = os.environ.get('AWS_COGNITO_REDIRECT_URL')
app.config["AWS_COGNITO_LOGOUT_URL"] = os.environ.get("AWS_COGNITO_LOGOUT_URL")
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

auth = CognitoAuth(app)

app.config['DYNAMO_TABLES'] = [
    {
         'TableName':'AirlineOnDPairs',
         'KeySchema':[dict(AttributeName='username', KeyType='HASH')],
         'AttributeDefinitions':[dict(AttributeName='username', AttributeType='S')],
         'ProvisionedThroughput':dict(ReadCapacityUnits=5, WriteCapacityUnits=5)
    }
 ]

# Instantiate a table resource object without actually
# creating a DynamoDB table. Note that the attributes of this table
# are lazy-loaded: a request is not made nor are the attribute
# values populated until the attributes
# on the table resource are accessed or its load() method is called.
dynamo = Dynamo(app)


@app.route("/login")
@cognito_login
def login():
    # A simple route that will redirect to the Cognito Hosted UI.
    # No logic is required as the decorator handles the redirect to the Cognito
    # hosted UI for the user to sign in.
    # An optional "state" value can be set in the current session which will
    # be passed and then used in the postlogin route (after the user has logged
    # into the Cognito hosted UI); this could be used for dynamic redirects,
    # for example, set `session['state'] = "some_custom_value"` before passing
    # the user to this route
    pass


@app.route("/postlogin")
@cognito_login_callback
def postlogin():
    # A route to handle the redirect after a user has logged in with Cognito.
    # This route must be set as one of the User Pool client's Callback URLs in
    # the Cognito console and also as the config value AWS_COGNITO_REDIRECT_URL.
    # The decorator will store the validated access token in a HTTP only cookie
    # and the user claims and info are stored in the Flask session:
    # session["claims"] and session["user_info"].
    # Do anything after the user has logged in here, e.g. a redirect or perform
    # logic based on a custom `session['state']` value if that was set before
    # login
    return redirect(url_for("claims"))


@app.route("/claims")
@auth_required()
def claims():
    # This route is protected by the Cognito authorisation. If the user is not
    # logged in at this point or their token from Cognito is no longer valid
    # a 401 Authentication Error is thrown, which can be caught by registering
    # an `@app.error_handler(AuthorisationRequiredError)
    # If their auth is valid, the current session will be shown including
    # their claims and user_info extracted from the Cognito tokens.
    return jsonify(session)


@app.route('/ond-pairs')
@auth_required()
def get_ond_pairs():
    response = dynamo.tables['AirlineOnDPairs'].scan()
    items = response['Items']
    return jsonify(items)

@app.route("/logout")
@cognito_logout
def logout():
    # Logout of the Cognito User pool and delete the cookies that were set
    # on login.
    # No logic is required here as it simply redirects to Cognito.
    pass


@app.route("/postlogout")
def postlogout():
    # This is the endpoint Cognito redirects to after a user has logged out,
    # handle any logic here, like returning to the homepage.
    # This route must be set as one of the User Pool client's Sign Out URLs.
    return redirect(url_for("home"))

@app.route("/")
def index():
    return render_template("index.html")

def create_connection():
    db_name = "postgres"
    db_user = "postgres"
    db_password = "banana123"
    db_host = "flightdb.cf4gue2iunia.eu-north-1.rds.amazonaws.com"
    db_port = "5432"
    connection = None
    try:
        connection = psycopg2.connect(
            database=db_name,
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
        )
        print("Connection to PostgreSQL DB successful")
    except OperationalError as e:
        print(f"The error '{e}' occurred")
    return connection

@app.route('/api/flights', methods=['GET'])
def get_flights():
    origin = request.args.get('origin', '')
    destination = request.args.get('destination', '')
    trip_type = request.args.get('trip_type', '')
    ond = f"{origin}-{destination}"
    nb_connections_min = request.args.get('nb_connections_min', type=int)
    nb_connections_max = request.args.get('nb_connections_max', type=int)

    sql_query = """
                SELECT
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_eur) AS median_price,
                    advance_purchase AS adv_purchase,
                    main_airline,
                    ond
                FROM (
                    SELECT
                        MIN(price_eur) AS price_eur,
                        main_airline,
                        advance_purchase,
                        ond
                    FROM
                        flight_recos
                    WHERE
                        trip_type = %s AND
                        ond = %s AND
                        number_of_flights > %s AND
                        number_of_flights <= %s + 1
                    GROUP BY
                        search_id,
                        main_airline,
                        advance_purchase,
                        ond
                ) AS t
                GROUP BY
                    advance_purchase, ond, main_airline
                ORDER BY advance_purchase DESC;
                """
    connection = create_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute(sql_query, (trip_type, ond, nb_connections_min, nb_connections_max))
            result = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            data = [dict(zip(columns, row)) for row in result]
            return jsonify(data)
        except Exception as e:
            print(f"An error occurred: {e}")
            return jsonify({"error": "Failed to fetch data"}), 500
        finally:
            cursor.close()
            connection.close()
    else:
        return jsonify({"error": "Connection to database failed"}), 500

@app.route('/api/cities', methods=['GET'])
def get_cities():
    query = "SELECT DISTINCT OND FROM flight_recos"
    connection = create_connection()
    if connection is not None:
        try:
            cursor = connection.cursor()
            cursor.execute(query)
            records = cursor.fetchall()
            origins = set()
            destinations = set()
            for record in records:
                origin, destination = record[0].split('-')
                origins.add(origin)
                destinations.add(destination)
            return jsonify({"origins": sorted(origins), "destinations": sorted(destinations)})
        except Exception as e:
            print(f"An error occurred: {e}")
            return jsonify({"error": "Failed to fetch data"}), 500
        finally:
            cursor.close()
            connection.close()
    else:
        return jsonify({"error": "Connection to database failed"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)