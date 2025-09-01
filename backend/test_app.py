import pytest
import json
import io
from unittest.mock import patch, MagicMock
import sqlite3
import mysql.connector
from app import app, get_db_connection, DB_CONFIG


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_table_data():
    """Sample table data for testing."""
    return {
        'columns': ['id', 'name', 'email'],
        'rows': [
            {'id': 1, 'name': 'John Doe', 'email': 'john@example.com'},
            {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com'}
        ],
        'types': ['INTEGER', 'TEXT', 'TEXT']
    }


@pytest.fixture
def sample_constraints():
    """Sample constraints for testing."""
    return [
        ['primary'],  # id column
        ['notnull'],  # name column
        ['unique']    # email column
    ]


class TestExportMySQL:
    """Test cases for the /export-mysql endpoint."""
    
    def test_export_mysql_success(self, client, sample_table_data, sample_constraints):
        """Test successful MySQL export."""
        data = {
            'table': 'users',
            'columns': sample_table_data['columns'],
            'rows': sample_table_data['rows'],
            'constraints': sample_constraints
        }
        
        response = client.post('/export-mysql', 
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'application/sql; charset=utf-8'
        assert 'attachment; filename=users.sql' in response.headers['Content-Disposition']
        
        # Check SQL content
        sql_content = response.data.decode('utf-8')
        assert 'CREATE TABLE IF NOT EXISTS `users`' in sql_content
        assert 'PRIMARY KEY (`id`)' in sql_content
        assert 'UNIQUE (`email`)' in sql_content
        assert 'INSERT INTO `users`' in sql_content
        assert 'John Doe' in sql_content
        assert 'jane@example.com' in sql_content

    def test_export_mysql_no_data(self, client):
        """Test MySQL export with no data."""
        data = {
            'table': 'empty_table',
            'columns': [],
            'rows': []
        }
        
        response = client.post('/export-mysql',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        assert response.json['error'] == 'No data to export'

    def test_export_mysql_missing_columns(self, client):
        """Test MySQL export with missing columns."""
        data = {
            'table': 'test_table',
            'rows': [{'id': 1}]
        }
        
        response = client.post('/export-mysql',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        assert response.json['error'] == 'No data to export'

    def test_export_mysql_with_null_values(self, client):
        """Test MySQL export with NULL values."""
        data = {
            'table': 'test_table',
            'columns': ['id', 'optional_field'],
            'rows': [
                {'id': 1, 'optional_field': None},
                {'id': 2, 'optional_field': 'value'}
            ],
            'constraints': [['primary'], []]
        }
        
        response = client.post('/export-mysql',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        sql_content = response.data.decode('utf-8')
        assert 'NULL' in sql_content
        assert "'value'" in sql_content

    def test_export_mysql_sql_injection_prevention(self, client):
        """Test that SQL injection is prevented through proper escaping."""
        data = {
            'table': 'test_table',
            'columns': ['name'],
            'rows': [{'name': "'; DROP TABLE users; --"}],
            'constraints': [[]]
        }
        
        response = client.post('/export-mysql',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        sql_content = response.data.decode('utf-8')
        # Check that single quotes are properly escaped
        assert "''; DROP TABLE users; --'" in sql_content


class TestQueryTemp:
    """Test cases for the /query-temp endpoint."""
    
    def test_query_temp_simple_select(self, client, sample_table_data):
        """Test simple SELECT query execution."""
        data = {
            'tables': {'users': sample_table_data},
            'query': 'SELECT * FROM users',
            'constraints': [['primary'], ['notnull'], ['unique']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert 'columns' in result
        assert 'rows' in result
        assert len(result['rows']) == 2
        assert result['columns'] == ['id', 'name', 'email']

    def test_query_temp_with_where_clause(self, client, sample_table_data):
        """Test SELECT query with WHERE clause."""
        data = {
            'tables': {'users': sample_table_data},
            'query': "SELECT name FROM users WHERE id = 1",
            'constraints': [['primary'], ['notnull'], ['unique']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert len(result['rows']) == 1
        assert result['rows'][0]['name'] == 'John Doe'

    def test_query_temp_missing_tables(self, client):
        """Test query execution with missing tables."""
        data = {
            'query': 'SELECT * FROM users'
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        assert 'Missing tables or query' in response.json['error']

    def test_query_temp_missing_query(self, client, sample_table_data):
        """Test query execution with missing query."""
        data = {
            'tables': {'users': sample_table_data}
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        assert 'Missing tables or query' in response.json['error']

    def test_query_temp_invalid_sql(self, client, sample_table_data):
        """Test query execution with invalid SQL."""
        data = {
            'tables': {'users': sample_table_data},
            'query': 'INVALID SQL STATEMENT',
            'constraints': [['primary'], ['notnull'], ['unique']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        assert 'Query execution failed' in response.json['error']

    def test_query_temp_with_join(self, client):
        """Test JOIN query execution."""
        users_data = {
            'columns': ['id', 'name'],
            'rows': [
                {'id': 1, 'name': 'John'},
                {'id': 2, 'name': 'Jane'}
            ],
            'types': ['INTEGER', 'TEXT']
        }
        
        orders_data = {
            'columns': ['id', 'user_id', 'product'],
            'rows': [
                {'id': 1, 'user_id': 1, 'product': 'Laptop'},
                {'id': 2, 'user_id': 2, 'product': 'Phone'}
            ],
            'types': ['INTEGER', 'INTEGER', 'TEXT']
        }
        
        data = {
            'tables': {
                'users': users_data,
                'orders': orders_data
            },
            'query': 'SELECT u.name, o.product FROM users u JOIN orders o ON u.id = o.user_id',
            'constraints': [['primary'], ['notnull']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert len(result['rows']) == 2
        assert result['rows'][0]['name'] == 'John'
        assert result['rows'][0]['product'] == 'Laptop'

    def test_query_temp_with_foreign_key_config(self, client):
        """Test query execution with foreign key configuration."""
        customers_data = {
            'columns': ['id', 'name'],
            'rows': [{'id': 1, 'name': 'Customer1'}],
            'types': ['INTEGER', 'TEXT']
        }
        
        orders_data = {
            'columns': ['id', 'customer_id'],
            'rows': [{'id': 1, 'customer_id': 1}],
            'types': ['INTEGER', 'INTEGER']
        }
        
        data = {
            'tables': {
                'customers': customers_data,
                'orders': orders_data
            },
            'query': 'SELECT * FROM orders',
            'constraints': [['primary'], ['notnull']],
            'foreignKeyConfig': {
                'primaryTable': 'customers',
                'foreignTable': 'orders',
                'foreignKeyColumn': 'customer_id',
                'primaryKeyColumn': 'id'
            }
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert 'metadata' in result
        assert result['metadata']['foreign_keys'] is not None

    def test_query_temp_different_data_types(self, client):
        """Test query execution with different data types."""
        mixed_data = {
            'columns': ['id', 'name', 'price', 'created_date', 'is_active'],
            'rows': [
                {
                    'id': 1,
                    'name': 'Product1',
                    'price': 29.99,
                    'created_date': '2023-01-01',
                    'is_active': True
                }
            ],
            'types': ['INTEGER', 'TEXT', 'DECIMAL', 'DATE', 'BOOLEAN']
        }
        
        data = {
            'tables': {'products': mixed_data},
            'query': 'SELECT * FROM products WHERE price > 20',
            'constraints': [['primary'], [], [], [], []]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert len(result['rows']) == 1

    def test_query_temp_table_alias(self, client, sample_table_data):
        """Test query execution with table aliases."""
        data = {
            'tables': {'users': sample_table_data},
            'query': 'SELECT u.name FROM users u WHERE u.id = 1',
            'constraints': [['primary'], ['notnull'], ['unique']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert len(result['rows']) == 1
        assert result['rows'][0]['name'] == 'John Doe'

    def test_query_temp_case_insensitive_table_names(self, client, sample_table_data):
        """Test that table name matching is case insensitive."""
        data = {
            'tables': {'Users': sample_table_data},  # Capital U
            'query': 'SELECT * FROM users',  # lowercase
            'constraints': [['primary'], ['notnull'], ['unique']]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert len(result['rows']) == 2


class TestDatabaseConnection:
    """Test cases for database connection functionality."""
    
    @patch('mysql.connector.connect')
    def test_get_db_connection_success(self, mock_connect):
        """Test successful database connection."""
        mock_connection = MagicMock()
        mock_connect.return_value = mock_connection
        
        connection = get_db_connection()
        
        mock_connect.assert_called_once_with(**DB_CONFIG)
        assert connection == mock_connection

    @patch('mysql.connector.connect')
    def test_get_db_connection_failure(self, mock_connect):
        """Test database connection failure."""
        mock_connect.side_effect = mysql.connector.Error("Connection failed")
        
        with pytest.raises(mysql.connector.Error):
            get_db_connection()


class TestApplicationRoutes:
    """Test cases for basic application routes."""
    
    def test_index_route(self, client):
        """Test the index route."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Database Repair API is running!' in response.data

    def test_cors_headers(self, client):
        """Test that CORS headers are properly set."""
        response = client.options('/export-mysql', 
                                headers={'Origin': 'http://localhost:3000'})
        
        # CORS headers should be present
        assert 'Access-Control-Allow-Origin' in response.headers

    def test_404_error(self, client):
        """Test 404 error for non-existent routes."""
        response = client.get('/non-existent-route')
        assert response.status_code == 404


class TestSQLiteInMemoryOperations:
    """Test cases for SQLite in-memory operations."""
    
    def test_sqlite_table_creation_with_constraints(self):
        """Test SQLite table creation with various constraints."""
        conn = sqlite3.connect(':memory:')
        cur = conn.cursor()
        
        # Test table creation
        create_sql = '''
        CREATE TABLE test_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            age INTEGER
        )
        '''
        cur.execute(create_sql)
        
        # Test data insertion
        cur.execute("INSERT INTO test_table (id, name, email, age) VALUES (?, ?, ?, ?)",
                   (1, 'John', 'john@test.com', 25))
        
        # Verify data
        result = cur.execute("SELECT * FROM test_table").fetchone()
        assert result == (1, 'John', 'john@test.com', 25)
        
        conn.close()

    def test_sqlite_foreign_key_constraint(self):
        """Test foreign key constraint creation in SQLite."""
        conn = sqlite3.connect(':memory:')
        conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign key support
        cur = conn.cursor()
        
        # Create parent table
        cur.execute('''
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            name TEXT
        )
        ''')
        
        # Create child table with foreign key
        cur.execute('''
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
        ''')
        
        # Insert test data
        cur.execute("INSERT INTO customers (id, name) VALUES (1, 'Customer1')")
        cur.execute("INSERT INTO orders (id, customer_id) VALUES (1, 1)")
        
        # Verify foreign key relationship
        result = cur.execute('''
        SELECT c.name, o.id 
        FROM customers c 
        JOIN orders o ON c.id = o.customer_id
        ''').fetchone()
        
        assert result == ('Customer1', 1)
        conn.close()


class TestErrorHandling:
    """Test cases for error handling scenarios."""
    
    def test_malformed_json_request(self, client):
        """Test handling of malformed JSON requests."""
        response = client.post('/export-mysql',
                             data='invalid json',
                             content_type='application/json')
        
        # Should handle the error gracefully
        assert response.status_code in [400, 500]

    def test_missing_content_type(self, client):
        """Test handling of requests without proper content type."""
        response = client.post('/export-mysql', data='{}')
        # Flask should handle this appropriately
        assert response.status_code in [400, 415]

    def test_large_dataset_handling(self, client):
        """Test handling of large datasets."""
        # Create a large dataset
        large_data = {
            'columns': ['id', 'data'],
            'rows': [{'id': i, 'data': f'data_{i}'} for i in range(1000)],
            'types': ['INTEGER', 'TEXT']
        }
        
        data = {
            'tables': {'large_table': large_data},
            'query': 'SELECT COUNT(*) as count FROM large_table',
            'constraints': [['primary'], []]
        }
        
        response = client.post('/query-temp',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 200
        result = response.json
        assert result['rows'][0]['count'] == 1000


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
