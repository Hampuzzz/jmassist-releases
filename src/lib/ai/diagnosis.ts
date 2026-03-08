/**
 * AI-powered DTC (Diagnostic Trouble Code) analysis.
 * Uses OpenAI API to provide repair suggestions.
 */

export interface DiagnosisResult {
  code:        string;
  description: string;
  causes:      string[];
  repair:      string;
  estimatedHours: string;
  parts:       string[];
  severity:    "low" | "medium" | "high";
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

/**
 * Get AI diagnosis for a DTC code.
 * Uses gpt-4o-mini for low cost (~$0.001 per request).
 */
export async function getDiagnosis(
  dtcCode: string,
  vehicleMake?: string,
  vehicleModel?: string,
  vehicleYear?: number,
): Promise<DiagnosisResult> {
  if (!OPENAI_API_KEY) {
    return getMockDiagnosis(dtcCode);
  }

  const vehicleInfo = [vehicleMake, vehicleModel, vehicleYear].filter(Boolean).join(" ");

  const prompt = `Du är en erfaren bilmekaniker med 20 års erfarenhet. Analysera OBD2-felkoden och svara EXAKT i detta JSON-format (inga extra fält):

{
  "code": "${dtcCode}",
  "description": "Kort beskrivning av felet (max 2 meningar på svenska)",
  "causes": ["Trolig orsak 1", "Trolig orsak 2", "Trolig orsak 3"],
  "repair": "Rekommenderad reparation (1-2 meningar på svenska)",
  "estimatedHours": "X-Y timmar",
  "parts": ["Reservdel 1", "Reservdel 2"],
  "severity": "low|medium|high"
}

Fordon: ${vehicleInfo || "Okänt"}
Felkod: ${dtcCode}

Svara BARA med JSON, ingen annan text.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      console.error(`[ai] OpenAI error ${res.status}`);
      return getMockDiagnosis(dtcCode);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr) as DiagnosisResult;
  } catch (err: any) {
    console.error("[ai] Diagnosis failed:", err.message);
    return getMockDiagnosis(dtcCode);
  }
}

/**
 * Fallback mock diagnosis when OpenAI is unavailable.
 */
function getMockDiagnosis(code: string): DiagnosisResult {
  const prefix = code.charAt(0).toUpperCase();
  const num = parseInt(code.substring(1), 10) || 0;

  const systems: Record<string, string> = {
    P: "Motor/växellåda",
    B: "Kaross",
    C: "Chassi",
    U: "Nätverk/kommunikation",
  };

  const system = systems[prefix] ?? "Okänt system";

  return {
    code,
    description: `Felkod ${code} relaterar till ${system.toLowerCase()}. Kontrollera relevanta komponenter och sensorer.`,
    causes: [
      "Defekt sensor eller givaranslutning",
      "Slitage på mekanisk komponent",
      "Elektriskt fel i kablage",
    ],
    repair: `Diagnos med OBD2-läsare rekommenderas. Kontrollera ${system.toLowerCase()}-relaterade komponenter.`,
    estimatedHours: "1-2 timmar",
    parts: ["Diagnostik", "Ev. sensor/givare"],
    severity: num > 300 ? "high" : num > 100 ? "medium" : "low",
  };
}
