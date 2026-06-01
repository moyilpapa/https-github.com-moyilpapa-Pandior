export async function parseNaturalLanguageInput(input: string, currentDate: string) {
  const response = await fetch("/api/gemini/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input, currentDate }),
  });
  if (!response.ok) {
    throw new Error(`Failed to contact assistant service: ${response.statusText}`);
  }
  return response.json();
}
