#!/bin/bash
# Step 1: Open SSE connection
SESSION_ID="scenario1-$(date +%s)"
curl -s -N "http://127.0.0.1:60060/sse" > /tmp/sse_scenario1.txt 2>&1 &
SSE_PID=$!
sleep 2

# Step 2: Check if there's an active ask
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_active_ask",
      "arguments": {}
    }
  }' 2>&1
echo "---GET_ACTIVE_ASK_SENT---"
sleep 3

# Step 3: Check task status
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

# Step 4: Get console dump to see what's happening
curl -s -X POST "http://127.0.0.1:60060/messages?sessionId=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_console_dump",
      "arguments": {"lines": 50, "excludePattern": "DEBUG: PROMPT"}
    }
  }' 2>&1
echo "---GET_CONSOLE_DUMP_SENT---"
sleep 3

echo "=== SSE OUTPUT ==="
cat /tmp/sse_scenario1.txt 2>/dev/null

kill $SSE_PID 2>/dev/null
