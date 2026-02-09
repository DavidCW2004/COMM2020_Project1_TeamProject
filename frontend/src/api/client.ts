const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
export type FacilitatorRoomStats = {
	code: string;
	name: string;
	active_participants: number;
	is_running: boolean;
	current_activity: string;
	post_count: number;
};

export type FacilitatorDashboardStatsResponse = {
	rooms: FacilitatorRoomStats[];
};

export type FacilitatorSessionSummary = {
	participation: any;
	quality: any;
	process: any;
	outcomes: any;
};

export type ActivityPhase = {
	name: string;
	prompt: string;
	duration_seconds?: number;
	assessment_criteria?: string[];
};

export type ActivityDTO = {
	id: number;
	name: string;
	description?: string | null;
	phases?: ActivityPhase[] | any;
	assessment_criteria?: string[] | any;
	created_at?: string;
};

export type RoomListItem = {
	code: string;
	name: string;
	members_count: number;
	is_running: boolean;
	selected_activity: { id: number; name: string } | null;
	created_at: string;
};

export async function createTempAccount(displayName: string, role: "learner" | "facilitator") {
	const url = `${API_BASE_URL}api/temp-login/`;
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
	await ensureCsrfCookie();
	return data;
}


export async function fetchMessages(roomCode: string) {
	const response = await fetch(`${API_BASE_URL}api/messages/?room=${encodeURIComponent(roomCode)}`, {
		method: "GET",
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error("Failed to fetch messages");
	}

	return (await response.json()) as Message[];
}

export async function postMessage(roomCode: string, content: string) {
	const response = await fetch(`${API_BASE_URL}api/messages/?room=${encodeURIComponent(roomCode)}`, {
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
	const response = await fetch(`${API_BASE_URL}api/rooms/`, {
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
	const response = await fetch(`${API_BASE_URL}api/rooms/`, {
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
	const res = await fetch(`${API_BASE_URL}api/rooms/${encodeURIComponent(code)}/`, {
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
	const res = await fetch(`${API_BASE_URL}api/rooms/${encodeURIComponent(code)}/members/`, {
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
		`${API_BASE_URL}api/rooms/${encodeURIComponent(code)}/start-activity/`,
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
		`${API_BASE_URL}api/rooms/${encodeURIComponent(code)}/summary/${params}`,
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
		`${API_BASE_URL}api/rooms/${encodeURIComponent(code)}/summary/export/`,
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

function buildError(detail: any, fallback: string) {
	if (typeof detail === "string" && detail.trim()) return detail;
	return fallback;
}

export async function fetchFacilitatorDashboardStats() {
	const res = await fetch(`${API_BASE_URL}api/facilitator/dashboard/`, {
		method: "GET",
		credentials: "include",
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch facilitator dashboard stats");
	}

	return (await res.json()) as { rooms: FacilitatorRoomStats[] };
}

export async function fetchFacilitatorActivities() {
	const res = await fetch(`${API_BASE_URL}api/facilitator/activities/`, {
		method: "GET",
		credentials: "include",
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(buildError(error.detail, "Failed to fetch activities"));
	}

	return res.json();
}

export async function createFacilitatorActivity(payload: any) {
	const url = `${API_BASE_URL}api/facilitator/activities/`;
	return authedJson(url, { method: "POST", body: JSON.stringify(payload) });
}


export async function updateFacilitatorActivity(id: number | string, payload: any) {
	const url = `${API_BASE_URL}api/facilitator/activities/${id}/`;
	return authedJson(url, { method: "PUT", body: JSON.stringify(payload) });
}

export async function fetchFacilitatorSessionSummary(roomCode: string, activityRunId?: string) {
	const base = `${API_BASE_URL}api/facilitator/room/${encodeURIComponent(roomCode)}/summary/`;
	const url = activityRunId ? `${base}?activity_run_id=${encodeURIComponent(activityRunId)}` : base;

	const res = await fetch(url, { method: "GET", credentials: "include" });

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch facilitator session summary");
	}

	return res.json();
}

export async function fetchFacilitatorRoomSummary(roomCode: string, activityRunId?: string) {
	const base = `${API_BASE_URL}api/facilitator/room/${encodeURIComponent(roomCode)}/summary/`;
	const url = activityRunId ? `${base}?activity_run_id=${encodeURIComponent(activityRunId)}` : base;

	const res = await fetch(url, { method: "GET", credentials: "include" });

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to fetch facilitator summary");
	}

	return (await res.json()) as FacilitatorSessionSummary;
}

export async function regenerateFacilitatorRoomSummary(roomCode: string, activityRunId?: string) {
	const base = `${API_BASE_URL}api/facilitator/room/${encodeURIComponent(roomCode)}/summary/`;
	const url = activityRunId ? `${base}?activity_run_id=${encodeURIComponent(activityRunId)}` : base;

	const csrf = getCookie("csrftoken");

	const res = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrf ? { "X-CSRFToken": csrf } : {}),
		},
		body: JSON.stringify({}),
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({}));
		throw new Error(error.detail || "Failed to regenerate facilitator summary");
	}

	return res.json();
}


export async function ensureCsrfCookie() {
	await fetch(`${API_BASE_URL}api/csrf/`, {
		method: "GET",
		credentials: "include",
	});
}

function getCookie(name: string) {
	const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
	return match ? decodeURIComponent(match[2]) : null;
}

export async function downloadRoomSummaryPDF(roomCode: string): Promise<Blob> {
	return exportSummaryPDF(roomCode);
}

export async function exportFacilitatorSummaryPDF(roomCode: string, activityRunId?: string): Promise<Blob> {
	const base = `${API_BASE_URL}api/facilitator/room/${encodeURIComponent(roomCode)}/summary/pdf/`;
	const url = activityRunId ? `${base}?activity_run_id=${encodeURIComponent(activityRunId)}` : base;

	const res = await fetch(url, { method: "GET", credentials: "include" });

	if (!res.ok) {
		const errorText = await res.text().catch(() => "");
		throw new Error(errorText || "Failed to export PDF");
	}

	return res.blob();
}

async function authedJson(url: string, init: RequestInit = {}) {
	const csrf = getCookie("csrftoken");
	const headers: Record<string, string> = {
		...(init.headers as Record<string, string> | undefined),
	};

	if (init.body) {
		headers["Content-Type"] = "application/json";
		if (csrf) headers["X-CSRFToken"] = csrf;
	}

	const res = await fetch(url, { credentials: "include", ...init, headers });

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.detail || `Request failed (${res.status})`);
	}

	return res.json();
}

export async function deleteFacilitatorActivity(id: number): Promise<void> {
	const url = `${API_BASE_URL}api/facilitator/activities/${id}/`;
	await authedJson(url, { method: "DELETE" });
}

export async function fetchRooms(): Promise<RoomListItem[]> {
	const res = await fetch(`${API_BASE_URL}api/rooms/`, {
		method: "GET",
		credentials: "include",
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.detail || "Failed to fetch rooms");
	}

	return res.json();
}
