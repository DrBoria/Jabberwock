#!/bin/bash
# Scenario 1 Step 3: Wait for plan generation and check state
SESSION_ID="scenario1-step3-$(date +%s)"
curl -s -N "http://127.0.0.1:60060/sse" > /tmp/sse_scenario1_step3.txt 2>&1 &
SSE_PID=$!
sleep 2

echo "=== STEP 1: Wait 15s for plan generation ==="
sleep 15

echo "=== STEP 2: Check task status ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_task_status",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_TASK_STATUS_SENT---"
sleep 3

echo "=== STEP 3: Check active ask ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_active_ask",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_ACTIVE_ASK_SENT---"
sleep 3

echo "=== STEP 4: Get todo list state ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_todo_list_state",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_TODO_LIST_STATE_SENT---"
sleep 3

echo "=== STEP 5: Get console dump ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_console_dump",
      "arguments": {"lines": 200, "excludePattern": "DEBUG: PROMPT"}
    }
  }' 2>&1
echo "---GET_CONSOLE_DUMP_SENT---"
sleep 3

echo "=== SSE OUTPUT ==="
cat /tmp/sse_scenario1_step3.txt 2>/dev/null

kill $SSE_PID 2>/dev/null
