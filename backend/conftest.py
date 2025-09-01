"""
Shared pytest fixtures and configuration for the database repair application tests.
"""
import pytest
import os
import tempfile
from unittest.mock import patch
from app import app


@pytest.fixture(scope="session")
def test_app():
    """Create application for testing."""
    app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SECRET_KEY": "test-secret-key"
    })
    return app


@pytest.fixture
def client(test_app):
    """Create a test client for the Flask application."""
    return test_app.test_client()


@pytest.fixture
def runner(test_app):
    """Create a test runner for the Flask application."""
    return test_app.test_cli_runner()


@pytest.fixture
def mock_db_config():
    """Mock database configuration for testing."""
    return {
        'host': 'localhost',
        'user': 'test_user',
        'password': 'test_password',
        'database': 'test_db'
    }


@pytest.fixture(autouse=True)
def mock_environment_variables():
    """Mock environment variables for testing."""
    with patch.dict(os.environ, {
        'MYSQL_HOST': 'test_host',
        'MYSQL_USER': 'test_user',
        'MYSQL_PASSWORD': 'test_password',
        'MYSQL_DATABASE': 'test_database'
    }):
        yield


@pytest.fixture
def sample_customers_data():
    """Sample customers table data."""
    return {
        'columns': ['id', 'name', 'email', 'phone'],
        'rows': [
            {'id': 1, 'name': 'John Doe', 'email': 'john@example.com', 'phone': '123-456-7890'},
            {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com', 'phone': '098-765-4321'},
            {'id': 3, 'name': 'Bob Wilson', 'email': 'bob@example.com', 'phone': '555-123-4567'}
        ],
        'types': ['INTEGER', 'TEXT', 'TEXT', 'TEXT']
    }


@pytest.fixture
def sample_orders_data():
    """Sample orders table data."""
    return {
        'columns': ['id', 'customer_id', 'product', 'quantity', 'price'],
        'rows': [
            {'id': 1, 'customer_id': 1, 'product': 'Laptop', 'quantity': 1, 'price': 999.99},
            {'id': 2, 'customer_id': 2, 'product': 'Mouse', 'quantity': 2, 'price': 29.99},
            {'id': 3, 'customer_id': 1, 'product': 'Keyboard', 'quantity': 1, 'price': 79.99},
            {'id': 4, 'customer_id': 3, 'product': 'Monitor', 'quantity': 1, 'price': 299.99}
        ],
        'types': ['INTEGER', 'INTEGER', 'TEXT', 'INTEGER', 'DECIMAL']
    }


@pytest.fixture
def foreign_key_config():
    """Sample foreign key configuration."""
    return {
        'primaryTable': 'customers',
        'foreignTable': 'orders',
        'foreignKeyColumn': 'customer_id',
        'primaryKeyColumn': 'id'
    }


@pytest.fixture
def complex_constraints():
    """Complex constraints for testing."""
    return [
        ['primary'],          # id
        ['notnull'],         # name
        ['unique', 'notnull'], # email
        []                   # phone (no constraints)
    ]
