import requests
import time
import os

# The base URL of the running container
BASE_URL = "http://localhost:5001"


def test_service_is_alive():
    """Simple check to see if the service is up before running other tests."""
    try:
        response = requests.get(f"{BASE_URL}/docs")
        assert response.status_code == 200
    except requests.ConnectionError as e:
        assert False, f"Connection failed. Is the Docker container running? {e}"


def test_success_path_integration():
    """Tests the happy path with REAL, runnable code that creates a file."""
    code_to_run = """
import pandas as pd
import plotly.express as px
df = pd.DataFrame({'x': [1, 2, 3], 'y': [4, 1, 7]})
fig = px.line(df, x='x', y='y', title='My Test Chart')
fig.write_html('/app/data/output/integration_test.html')
"""
    response = requests.post(
        f"{BASE_URL}/execute",
        json={"code": code_to_run, "filename_prefix": "integration_test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["output_html_path"] == "/app/data/output/integration_test.html"


def test_code_execution_error_integration():
    """Tests a runtime error (division by zero) in the executed code."""
    response = requests.post(
        f"{BASE_URL}/execute",
        json={"code": "x = 1 / 0", "filename_prefix": "div_zero_test"},
    )
    # This response has a 200 OK status, with the error described in the body
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert data["error_code"] == 1000  # This is where the KeyError was likely happening
    assert "ZeroDivisionError" in data["details"]["stderr"]


def test_logical_error_integration():
    """Tests code that runs successfully but doesn't create the output file."""
    response = requests.post(
        f"{BASE_URL}/execute",
        json={"code": "x = 1 + 1\nprint('I did nothing useful')", "filename_prefix": "logical_error_test"},
    )
    # This response also has a 200 OK status
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert data["error_code"] == 1100


def test_security_error_integration():
    """Tests the forbidden keyword check."""
    response = requests.post(
        f"{BASE_URL}/execute",
        json={"code": "import os\nprint(os.getcwd())", "filename_prefix": "security_test"},
    )
    # This response has a 400 Bad Request status
    assert response.status_code == 400

    # --- FINAL FIX ---
    # First, get the top-level JSON object
    response_data = response.json()

    # Then, access the actual error payload inside the "detail" key
    error_payload = response_data["detail"]

    # Now, assert against the payload
    assert error_payload["error_code"] == 2000
    assert "Security Violation" in error_payload["details"]["stderr"]