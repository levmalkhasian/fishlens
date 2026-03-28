import { NextRequest } from "next/server";

/** Wrap raw PCM (16-bit LE mono) in a WAV header so browsers can play it */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // fmt chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { text } = body;
  if (!text || text.length < 5) {
    return new Response("Text too short", { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey || apiKey.startsWith("your_")) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const truncated = text.slice(0, 3000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `Say the following in a clear, friendly tone:\n\n${truncated}` }],
          },
        ],
        generationConfig: {
          response_modalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore",
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[tts] Gemini TTS failed:", res.status, err);
      return new Response(JSON.stringify({ error: "TTS generation failed", detail: err }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const audioPart = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
    );

    if (!audioPart?.inlineData) {
      console.error("[tts] No audio in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No audio generated" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pcmBuffer = Buffer.from(audioPart.inlineData.data, "base64");

    // Parse sample rate from mime type (e.g. "audio/L16;codec=pcm;rate=24000")
    const rateMatch = audioPart.inlineData.mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const wavBuffer = pcmToWav(pcmBuffer, sampleRate);

    return new Response(new Uint8Array(wavBuffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wavBuffer.length),
      },
    });
  } catch (err) {
    console.error("[tts] Error:", err);
    return new Response(JSON.stringify({ error: "TTS request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
