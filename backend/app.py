# --- Export MySQL endpoint ---
from flask import send_file
import io
import os
import re
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector

CORS_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

app = Flask(__name__)
CORS(app, origins=CORS_origins, supports_credentials=True)

@app.route('/export-mysql', methods=['POST'])
def export_mysql():
    data = request.get_json()
    table = data.get('table', 'table')
    columns = data.get('columns', [])
    rows = data.get('rows', [])
    constraints = data.get('constraints', [])
    if not columns or not rows:
        return jsonify({'error': 'No data to export'}), 400
    # Build column definitions with constraints
    col_defs_list = []
    pk_cols = []
    unique_cols = []
    for idx, col in enumerate(columns):
        col_def = f'`{col}` TEXT'
        if constraints and idx < len(constraints):
            cons = constraints[idx]
            if cons:
                if 'notnull' in cons:
                    col_def += ' NOT NULL'
                if 'unique' in cons:
                    unique_cols.append(col)
                if 'primary' in cons:
                    pk_cols.append(col)
        col_defs_list.append(col_def)
    # Add PRIMARY KEY and UNIQUE constraints at the table level if needed
    table_constraints = []
    if pk_cols:
        pk_str = ', '.join([f'`{c}`' for c in pk_cols])
        table_constraints.append(f'PRIMARY KEY ({pk_str})')
    if unique_cols:
        unique_str = ', '.join([f'`{c}`' for c in unique_cols])
        table_constraints.append(f'UNIQUE ({unique_str})')
    all_defs = col_defs_list + table_constraints
    col_defs = ', '.join(all_defs)
    sql_lines = [f"CREATE TABLE IF NOT EXISTS `{table}` ({col_defs});"]
    for row in rows:
        values = []
        for col in columns:
            val = row.get(col, '')
            if val is None:
                values.append('NULL')
            else:
                sval = str(val).replace("'", "''")
                values.append(f"'{sval}'")
        sql_lines.append(f"INSERT INTO `{table}` ({', '.join(f'`{col}`' for col in columns)}) VALUES ({', '.join(values)});")
    sql_content = '\n'.join(sql_lines)
    buf = io.BytesIO(sql_content.encode('utf-8'))
    buf.seek(0)
    return send_file(buf, mimetype='application/sql', as_attachment=True, download_name=f'{table}.sql')


# Temporary SQL query endpoint for in-memory table
@app.route('/query-temp', methods=['POST'])
def query_temp():
    try:
        data = request.get_json()
        tables = data.get('tables', {})  # Dictionary of table_name -> {columns, rows}
        query = data.get('query')
        constraints = data.get('constraints')
        foreign_key_config = data.get('foreignKeyConfig')

        if not tables or not query:
            return jsonify({'error': 'Missing tables or query'}), 400
        
        # Use in-memory SQLite for temp query
        conn = sqlite3.connect(':memory:')  # This creates a temporary database that exists only in RAM
        cur = conn.cursor()

        # Extract actual table names used in the query
        table_mapping = {}
        
        # Find all table references in the query using FROM and JOIN
        query_tables = []
        
        # First extract bare table names from the query
        table_pattern = r'\bFROM\s+([A-Za-z_]\w*)\s*(\w+)?|\bJOIN\s+([A-Za-z_]\w*)\s*(\w+)?'
        
        # Find all matches in the query
        for match in re.finditer(table_pattern, query, re.IGNORECASE):
            # Get table name and alias from FROM clause
            from_table = match.group(1)
            from_alias = match.group(2)
            # Get table name and alias from JOIN clause
            join_table = match.group(3)
            join_alias = match.group(4)
            
            # Process FROM clause match
            if from_table:
                table_name = from_table
                alias = from_alias
            # Process JOIN clause match
            elif join_table:
                table_name = join_table
                alias = join_alias
            else:
                continue
            
            # Check if this exact table name exists in input
            matched_input_table = None
            if table_name.lower() in [t.lower() for t in tables.keys()]:
                # Find the exact match (preserving case)
                for input_name in tables.keys():
                    if input_name.lower() == table_name.lower():
                        matched_input_table = input_name
                        break
            
            # Store table info - using exact table name from query
            table_info = {
                'name': table_name,  # Exact name from query
                'alias': alias,
                'data': tables.get(matched_input_table) if matched_input_table else None
            }
            query_tables.append(table_info)
            
            if matched_input_table:
                # Store the mapping using the exact name from the query
                table_mapping[table_name] = alias if alias else table_name

        # Sort tables so referenced (primary) tables are created first
        def is_foreign_table(table_name):
            if not foreign_key_config:
                return False
            return table_name.lower() == foreign_key_config.get('foreignTable', '').lower()

        def is_primary_table(table_name):
            if not foreign_key_config:
                return False
            return table_name.lower() == foreign_key_config.get('primaryTable', '').lower()

        # Sort tables - primary tables first, then foreign key tables
        sorted_tables = sorted(query_tables, key=lambda x: is_foreign_table(x['name']))
        
        for query_table in sorted_tables:
            if not query_table['data']:
                continue

            table_data = query_table['data']
            columns = table_data.get('columns', [])
            rows = table_data.get('rows', [])
            
            if not columns or not rows:
                continue
                
            # Always use the original table name from query, not the alias
            table_name = query_table['name']

            # Build column definitions with constraints
            col_defs_list = []
            pk_cols = []
            unique_cols = []
            
            # Get column types if provided
            column_types = table_data.get('types', ['TEXT'] * len(columns))
            
            for idx, col in enumerate(columns):
                # Map frontend types to SQLite types
                col_type = str(column_types[idx]).upper() if idx < len(column_types) else 'TEXT'
                
                # Map normalized frontend types to SQLite types
                sql_type = {
                    'INTEGER': 'INTEGER',
                    'DECIMAL': 'REAL',
                    'NUMERIC': 'NUMERIC',
                    'VARCHAR': 'TEXT',
                    'CHAR': 'TEXT',
                    'TEXT': 'TEXT',
                    'DATE': 'DATE',
                    'DATETIME': 'DATETIME',
                    'TIMESTAMP': 'DATETIME',
                    'TIME': 'TIME',
                    'BLOB': 'BLOB',
                    'BOOLEAN': 'BOOLEAN',
                }.get(col_type, 'TEXT')  # Default to TEXT for unknown types
                
                col_def = f'"{col}" {sql_type}'
                if constraints and idx < len(constraints):
                    cons = constraints[idx]
                    if cons:
                        if 'notnull' in cons:
                            col_def += ' NOT NULL'
                        if 'unique' in cons:
                            unique_cols.append(col)
                        if 'primary' in cons:
                            pk_cols.append(col)
                col_defs_list.append(col_def)

            # Add PRIMARY KEY and UNIQUE constraints at the table level if needed
            table_constraints = []

            # Add primary key constraint if we have primary key columns
            if pk_cols:
                pk_str = ', '.join([f'"{c}"' for c in pk_cols])
                table_constraints.append(f'PRIMARY KEY ({pk_str})')

            # Add unique constraints if we have unique columns
            if unique_cols:
                unique_str = ', '.join([f'"{c}"' for c in unique_cols])
                table_constraints.append(f'UNIQUE ({unique_str})')
            
            # Add foreign key constraint if configured
            if foreign_key_config:
                fk_column = foreign_key_config.get('foreignKeyColumn')
                primary_table = foreign_key_config.get('primaryTable')
                primary_key_column = foreign_key_config.get('primaryKeyColumn')
                foreign_table = foreign_key_config.get('foreignTable')
                
                # Check if this is the foreign table and we have all needed info
                if foreign_table and foreign_table.lower() == query_table['name'].lower() and fk_column and primary_table and primary_key_column:
                    # Find the referenced table's name as it appears in the query
                    referenced_table_name = None
                    for qt in query_tables:
                        if qt['name'].lower() == primary_table.lower():
                            referenced_table_name = qt['name']  # Use the exact name from query
                            break
                            
                    if referenced_table_name:
                        table_constraints.append(
                            f'FOREIGN KEY ("{fk_column}") REFERENCES "{referenced_table_name}" ("{primary_key_column}")'
                        )

            # Combine column definitions and constraints
            all_defs = col_defs_list + table_constraints
            col_defs = ', '.join(all_defs)
            
            # Create table using the query table name
            create_table_sql = f'CREATE TABLE "{table_name}" ({col_defs})'
            result = cur.execute(create_table_sql)
            
            # Insert rows using the query table name
            placeholders = ', '.join(['?'] * len(columns))
            for row in rows:
                vals = [row.get(col, None) for col in columns]
                sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
                result = cur.execute(sql, vals)
            
            # Verify the inserted data
            result = cur.execute(f'SELECT * FROM "{table_name}" LIMIT 3')
            rows = result.fetchall()

        try:
            # Verify table structure before executing query
            for table in sorted_tables:
                cur.execute(f"SELECT * FROM sqlite_master WHERE type='table' AND name=?", (table['name'],))
                table_info = cur.fetchone()
                if table_info:
                    # Show sample data
                    cur.execute(f'SELECT * FROM "{table["name"]}" LIMIT 1')
                    sample = cur.fetchone()

            result = cur.execute(query)
            result_rows = result.fetchall()
            result_cols = [desc[0] for desc in cur.description]
            
            # Convert to list of dicts and show sample results
            result = [dict(zip(result_cols, row)) for row in result_rows]
        except sqlite3.Error as e:
            return jsonify({'error': f'Query execution failed: {str(e)}'}), 400
        
        response_data = {
            'columns': result_cols, 
            'rows': result,
            'metadata': {
                'tables': list(tables.keys()),
                'constraints': constraints,
                'foreign_keys': foreign_key_config,
                'execution_type': 'in_memory_sqlite'
            }
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass

# MySQL connection config (update with your credentials)
DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'Shaunferns28@'),
    'database': os.environ.get('MYSQL_DATABASE', 'repairdb')
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@app.route('/')
def index():
    return 'Database Repair API is running!'


if __name__ == '__main__':
    app.run(debug=True)
