const BASE_URL = "https://kylmakaappibackend-d3fef21b1e11.herokuapp.com";

// Yleinen GET-pyyntöfunktio

export async function apiGet(path: string) {
    // Haetaan dataa backendistä (HTTP GET)
    const res = await fetch(`${BASE_URL}${path}`);

    // Jos vastauskoodi ei ole 200 OK → heitetään virhe
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    
    return res.json();
}

// Yleinen POST-pyyntöfunktio
export async function apiPost(path: string, body: object) {

    // Lähetetään POST backendille
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// UUSI: moottori 5s, suunta fwd|rev
export async function motorRun(deviceId: string, ms = 5000, dir: "fwd" | "rev" = "fwd") {
    return apiPost("/motor", { deviceId, ms, dir });
  }

  export async function motorPay(deviceId: string, dir: "fwd" | "rev" = "fwd") {
    return apiPost("/motor/pay", { deviceId, dir });
  }
  
  export { BASE_URL };

