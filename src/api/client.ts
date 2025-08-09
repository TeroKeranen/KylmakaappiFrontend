const BASE_URL = "http://192.168.0.23:3000";

export async function apiGet(path: string) {
    const res = await fetch(`${BASE_URL}${path}`);

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    
    return res.json();
}

export async function apiPost(path: string, body: object) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

