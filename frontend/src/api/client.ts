const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type TempLoginResponse = {
	id: number;
	username: string;
	display_name: string;
	role: string;
};

export type Message = {
	id: number;
	room: number;
	room_code: string;
	author: number;
	author_name: string;
	content: string;
	created_at: string;
};

export async function createTempAccount(displayName: string, role: "learner" | "facilitator") {
	const response = await fetch(`${API_BASE_URL}/api/temp-login/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({
			display_name: displayName,
			role,
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to create temporary account");
	}

	return (await response.json()) as TempLoginResponse;
}

export async function fetchMessages(roomCode: string) {
	const response = await fetch(`${API_BASE_URL}/api/messages/?room=${encodeURIComponent(roomCode)}`, {
		method: "GET",
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error("Failed to fetch messages");
	}

	return (await response.json()) as Message[];
}

export async function postMessage(roomCode: string, content: string) {
	const response = await fetch(`${API_BASE_URL}/api/messages/?room=${encodeURIComponent(roomCode)}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ content }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to post message");
	}

	return (await response.json()) as Message;
}

export async function createRoom(name: string) {
	const response = await fetch(`${API_BASE_URL}/api/rooms/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ action: "create", name }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to create room");
	}

	return (await response.json()) as { code: string; name: string };
}

export async function joinRoom(code: string) {
	const response = await fetch(`${API_BASE_URL}/api/rooms/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ action: "join", code }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to join room");
	}

	return (await response.json()) as { code: string; name: string };
}
