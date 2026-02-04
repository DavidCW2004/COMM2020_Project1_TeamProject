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

export type Room = {
	code: string;
	name: string;
	selected_activity: { id: number; name: string } | null;
	activity: {
		is_running: boolean;
		finished: boolean;
		activity_id: number | null;
		activity_name: string | null;
		phase_index?: number | null;
		phase_name?: string | null;
		phase_prompt?: string | null;
		phase_ends_at?: string | null;
		total_phases?: number | null;
	};
};

export async function createTempAccount(displayName: string, role: "learner" | "facilitator") {
	const url = `${API_BASE_URL}/api/temp-login/`;
	console.log("Fetching:", url);
	const response = await fetch(url, {
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

	console.log("Response status:", response.status);
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		console.error("Response error:", error);
		throw new Error(error.detail || "Failed to create temporary account");
	}

	const data = (await response.json()) as TempLoginResponse;
	console.log("Response data:", data);
	return data;
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


export async function fetchRoom(code: string) {
	const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/`, {
		method: "GET",
		credentials: "include",
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch room");
	}

	return res.json() as Promise<Room>;
}

export async function fetchRoomMembers(code: string) {
	const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/members/`, {
		method: "GET",
		credentials: "include",
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch room members");
	}

	return res.json() as Promise<Array<{ id: number; name: string }>>;
}

export async function startRoomActivity(code: string): Promise<void> {
	const res = await fetch(
		`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/start-activity/`,
		{
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
		}
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to start activity (${res.status}): ${text}`);
	}
}

export async function fetchSessionSummary(code: string, activityRunId?: string) {
	const params = activityRunId ? `?activity_run_id=${activityRunId}` : "";
	const res = await fetch(
		`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/summary/${params}`,
		{
			method: "GET",
			credentials: "include",
		}
	);

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch session summary");
	}

	return res.json();
}

export async function exportSummaryPDF(code: string): Promise<Blob> {
	const res = await fetch(
		`${API_BASE_URL}/api/rooms/${encodeURIComponent(code)}/summary/export/`,
		{
			method: "GET",
			credentials: "include",
		}
	);

	if (!res.ok) {
		throw new Error("Failed to export PDF");
	}

	return res.blob();
}
