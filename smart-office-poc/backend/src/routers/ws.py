from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Tuple

router = APIRouter(
    prefix="/ws",
    tags=["websockets"]
)

class ConnectionManager:
    def __init__(self):
        # Map doc_id -> List[(WebSocket, user)]
        self.active_connections: Dict[str, List[Tuple[WebSocket, str]]] = {}

    async def connect(self, websocket: WebSocket, doc_id: str, user: str):
        await websocket.accept()
        if doc_id not in self.active_connections:
            self.active_connections[doc_id] = []
        self.active_connections[doc_id].append((websocket, user))
        await self._broadcast_presence(doc_id, event="user_joined", user=user)

    def disconnect(self, websocket: WebSocket, doc_id: str):
        if doc_id in self.active_connections:
             for item in list(self.active_connections[doc_id]):
                if item[0] == websocket:
                    self.active_connections[doc_id].remove(item)
                    break
             if not self.active_connections[doc_id]:
                del self.active_connections[doc_id]

    async def broadcast(self, doc_id: str, message: dict):
        if doc_id in self.active_connections:
            for connection, _user in list(self.active_connections[doc_id]):
                await connection.send_json(message)

    def _users(self, doc_id: str) -> List[str]:
        if doc_id not in self.active_connections:
            return []
        return [user for _ws, user in self.active_connections[doc_id]]

    async def _broadcast_presence(self, doc_id: str, event: str, user: str):
        users = self._users(doc_id)
        count = len(users)
        await self.broadcast(doc_id, {"type": "presence", "count": count, "users": users})
        await self.broadcast(doc_id, {"type": event, "user": user, "count": count, "users": users})

manager = ConnectionManager()

@router.websocket("/documents/{doc_id}")
async def websocket_endpoint(websocket: WebSocket, doc_id: str):
    user = websocket.query_params.get("user", "anonymous")
    await manager.connect(websocket, doc_id, user)
    try:
        while True:
            data = await websocket.receive_json()
            # Echo back or broadcast logic
            # For v1, we mostly just broadcast updates
            await manager.broadcast(doc_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, doc_id)
        if doc_id in manager.active_connections:
            await manager._broadcast_presence(doc_id, event="user_left", user=user)
