#!/bin/bash

# Test script for STORM Research API
echo "🔬 Testing STORM Research API..."

# Check if backend is running
echo "1. Checking backend health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if [ $? -eq 0 ]; then
    echo "✅ Backend is running"
    echo "Response: $HEALTH_RESPONSE"
else
    echo "❌ Backend is not accessible. Please start it with 'npm start'"
    exit 1
fi

echo ""

# Test 1: Valid request
echo "2. Testing valid STORM research request..."
STORM_RESPONSE=$(curl -s -X POST http://localhost:3001/api/storm/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is renewable energy?",
    "notionParentId": "1fe8a6c3e40b80dfa959f4a922519c15"
  }')

if echo "$STORM_RESPONSE" | jq -e '.stormResult.success' > /dev/null 2>&1; then
    echo "✅ STORM research successful!"
    echo "Notion Page URL: $(echo "$STORM_RESPONSE" | jq -r '.notionPageUrl')"
    echo "Notion Page ID: $(echo "$STORM_RESPONSE" | jq -r '.notionPageId')"
else
    echo "❌ STORM research failed"
    echo "Error: $(echo "$STORM_RESPONSE" | jq -r '.error // .stormResult.error // "Unknown error"')"
fi

echo ""

# Test 2: Missing query
echo "3. Testing missing query parameter..."
MISSING_QUERY=$(curl -s -X POST http://localhost:3001/api/storm/research \
  -H "Content-Type: application/json" \
  -d '{
    "notionParentId": "1fe8a6c3e40b80dfa959f4a922519c15"
  }')

if echo "$MISSING_QUERY" | jq -e '.error' > /dev/null 2>&1; then
    echo "✅ Properly handled missing query"
    echo "Error: $(echo "$MISSING_QUERY" | jq -r '.error')"
else
    echo "❌ Should have returned an error for missing query"
fi

echo ""

# Test 3: Missing notionParentId
echo "4. Testing missing notionParentId parameter..."
MISSING_PARENT=$(curl -s -X POST http://localhost:3001/api/storm/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test query"
  }')

if echo "$MISSING_PARENT" | jq -e '.error' > /dev/null 2>&1; then
    echo "✅ Properly handled missing notionParentId"
    echo "Error: $(echo "$MISSING_PARENT" | jq -r '.error')"
else
    echo "❌ Should have returned an error for missing notionParentId"
fi

echo ""
echo "🏁 Testing completed!" 