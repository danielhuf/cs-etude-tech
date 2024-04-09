from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2 import OperationalError
import pandas as pd

app = Flask(__name__)
CORS(app)

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