import pytest
from fastapi.testclient import TestClient
from src.app import app

# Create a test client
client = TestClient(app)

def test_root_serves_index_html():
    """Test that root URL serves index.html directly"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert b"<!DOCTYPE html>" in response.content  # Check it's actually HTML content

def test_get_activities():
    """Test that activities endpoint returns expected data structure"""
    response = client.get("/activities")
    assert response.status_code == 200
    data = response.json()
    
    # Check that we get a dict of activities
    assert isinstance(data, dict)
    
    # Check structure of an activity (using Chess Club as example)
    chess = data["Chess Club"]
    assert isinstance(chess, dict)
    assert all(key in chess for key in ["description", "schedule", "max_participants", "participants"])
    assert isinstance(chess["participants"], list)

def test_signup_flow():
    """Test the signup flow including validation"""
    activity = "Chess Club"
    email = "newstudent@mergington.edu"
    
    # First check initial participants
    response = client.get("/activities")
    initial_count = len(response.json()[activity]["participants"])
    
    # Try to signup
    response = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert response.status_code == 200
    assert "Signed up" in response.json()["message"]
    
    # Verify participant was added
    response = client.get("/activities")
    assert len(response.json()[activity]["participants"]) == initial_count + 1
    assert email in response.json()[activity]["participants"]
    
    # Try to signup same email again (should fail)
    response = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert response.status_code == 400
    assert "already signed up" in response.json()["detail"]

def test_signup_nonexistent_activity():
    """Test signup validation for non-existent activity"""
    response = client.post("/activities/NonexistentClub/signup", params={"email": "test@mergington.edu"})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_unregister_flow():
    """Test the unregister flow including validation"""
    # First add a test participant to Chess Club
    activity = "Chess Club"
    email = "tempstudent@mergington.edu"
    
    # Sign them up first
    signup_response = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert signup_response.status_code == 200
    
    # Get initial count
    response = client.get("/activities")
    initial_count = len(response.json()[activity]["participants"])
    
    # Try to unregister
    response = client.post(f"/activities/{activity}/unregister", params={"email": email})
    assert response.status_code == 200
    assert "Unregistered" in response.json()["message"]
    
    # Verify participant was removed
    response = client.get("/activities")
    assert len(response.json()[activity]["participants"]) == initial_count - 1
    assert email not in response.json()[activity]["participants"]
    
    # Try to unregister again (should fail)
    response = client.post(f"/activities/{activity}/unregister", params={"email": email})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_unregister_nonexistent_activity():
    """Test unregister validation for non-existent activity"""
    response = client.post("/activities/NonexistentClub/unregister", params={"email": "test@mergington.edu"})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_max_participants():
    """Test that activities enforce maximum participant limits"""
    activity = "Chess Club"
    
    # Get initial state
    response = client.get("/activities")
    chess = response.json()[activity]
    max_spots = chess["max_participants"]
    current_count = len(chess["participants"])
    
    # Fill remaining spots
    for i in range(current_count, max_spots):
        email = f"student{i}@mergington.edu"
        response = client.post(f"/activities/{activity}/signup", params={"email": email})
        assert response.status_code == 200
    
    # Try to add one more (should fail)
    response = client.post(f"/activities/{activity}/signup", params={"email": "overflow@mergington.edu"})
    assert response.status_code == 400
    assert "full" in response.json()["detail"].lower()