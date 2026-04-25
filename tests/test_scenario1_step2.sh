#!/bin/bash
# Scenario 1: Create a task and test plan generation + delegation
SESSION_ID="scenario1-step2-$(date +%s)"
curl -s -N "http://127.0.0.1:60060/sse" > /tmp/sse_scenario1_step2.txt 2>&1 &
SSE_PID=$!
sleep 2

echo "=== STEP 1: Create a new task ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "send_chat_request",
      "arguments": {
        "prompt": "какие mcp тебе доступны? Что ты можешь в них делать? После ответа переключи на дизайнера и спроси у него, что он видит и что может делать",
        "mode": "orchestrator"
      }
    }
  }' 2>&1
echo "---SEND_CHAT_REQUEST_SENT---"
sleep 5

echo "=== STEP 2: Check task status ==="
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

echo "=== STEP 3: Check active ask ==="
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

echo "=== STEP 4: Get console dump ==="
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_console_dump",
      "arguments": {"lines": 100, "excludePattern": "DEBUG: PROMPT"}
    }
  }' 2>&1
echo "---GET_CONSOLE_DUMP_SENT---"
sleep 3

echo "=== SSE OUTPUT ==="
cat /tmp/sse_scenario1_step2.txt 2>/dev/null

kill $SSE_PID 2>/dev/null
