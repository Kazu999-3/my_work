async function testRebuild() {
  const url = 'https://my-work-8jbd.vercel.app/api/mmr/rebuild';
  console.log("Sending POST to:", url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testRebuild();
