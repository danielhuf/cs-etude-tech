from flask import Flask, jsonify
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
                        advance_purchase, ond
                    FROM
                        flight_recos
                    WHERE
                        trip_type = 'RT'
                        AND ond = 'PAR-LIS'
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
    if connection is not None:
        df = pd.read_sql_query(sql_query, con=connection)
        connection.close()
        return jsonify(df.to_dict(orient='records')) 
    else:
        return jsonify({"error": "Connection to database failed"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)