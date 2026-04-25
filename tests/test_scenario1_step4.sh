#!/bin/bash
# Scenario 1 Step 4: Approve the MCP tool use and wait for plan
SESSION_ID="scenario1-step4-$(date +%s)"
curl -s -N "http://127.0.0.1:60060/sse" > /tmp/sse_scenario1_step4.txt 2>&1 &
SSE_PID=$!
sleep 2

echo "=== STEP 1: Approve the MCP tool use (respond_to_ask with yesButtonClicked) ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "respond_to_ask",
      "arguments": {
        "response": "yesButtonClicked"
      }
    }
  }' 2>&1
echo "---RESPOND_TO_ASK_SENT---"
sleep 5

echo "=== STEP 2: Wait 30s for plan generation ==="
sleep 30

echo "=== STEP 3: Check task status ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_task_status",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_TASK_STATUS_SENT---"
sleep 3

echo "=== STEP 4: Check active ask ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_active_ask",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_ACTIVE_ASK_SENT---"
sleep 3

echo "=== STEP 5: Get todo list state ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_todo_list_state",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_TODO_LIST_STATE_SENT---"
sleep 3

echo "=== STEP 6: Get console dump ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_console_dump",
      "arguments": {"lines": 200, "excludePattern": "DEBUG: PROMPT"}
    }
  }' 2>&1
echo "---GET_CONSOLE_DUMP_SENT---"
sleep 3

echo "=== SSE OUTPUT ==="
cat /tmp/sse_scenario1_step4.txt 2>/dev/null

kill $SSE_PID 2>/dev/null
