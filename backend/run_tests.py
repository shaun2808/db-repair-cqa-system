#!/usr/bin/env python3
"""
Test runner script for the database repair application.

Usage:
    python run_tests.py                    # Run all tests
    python run_tests.py --unit            # Run only unit tests
    python run_tests.py --integration     # Run only integration tests
    python run_tests.py --coverage        # Run tests with coverage report
    python run_tests.py --verbose         # Run with verbose output
"""

import sys
import subprocess
import argparse
import os


def run_command(command, description):
    """Run a command and handle errors."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(command)}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Command failed with exit code {e.returncode}")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False
    except FileNotFoundError:
        print(f"ERROR: Command not found. Make sure pytest is installed.")
        print("Install with: pip install -r requirements-test.txt")
        return False


def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import pytest
        import flask
        print("✓ Required dependencies are available")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Install dependencies with: pip install -r requirements-test.txt")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run tests for database repair application")
    parser.add_argument("--unit", action="store_true", help="Run only unit tests")
    parser.add_argument("--integration", action="store_true", help="Run only integration tests")
    parser.add_argument("--coverage", action="store_true", help="Run with coverage report")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--fast", action="store_true", help="Skip slow tests")
    parser.add_argument("--file", type=str, help="Run specific test file")
    
    args = parser.parse_args()
    
    # Check dependencies first
    if not check_dependencies():
        sys.exit(1)
    
    # Base pytest command
    pytest_cmd = ["python", "-m", "pytest"]
    
    # Add coverage if requested
    if args.coverage:
        pytest_cmd.extend([
            "--cov=app",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-fail-under=80"
        ])
    
    # Add verbosity
    if args.verbose:
        pytest_cmd.append("-v")
    else:
        pytest_cmd.append("-q")
    
    # Add marker filters
    if args.unit:
        pytest_cmd.extend(["-m", "unit"])
    elif args.integration:
        pytest_cmd.extend(["-m", "integration"])
    elif args.fast:
        pytest_cmd.extend(["-m", "not slow"])
    
    # Add specific file if requested
    if args.file:
        pytest_cmd.append(args.file)
    
    # Add output formatting
    pytest_cmd.extend([
        "--tb=short",
        "--strict-markers"
    ])
    
    # Run the tests
    success = run_command(pytest_cmd, "Running pytest")
    
    if args.coverage and success:
        print("\n" + "="*60)
        print("Coverage report generated in htmlcov/index.html")
        print("="*60)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
