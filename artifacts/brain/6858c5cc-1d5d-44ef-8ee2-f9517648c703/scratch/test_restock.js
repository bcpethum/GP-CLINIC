async function run() {
  const drugId = 2; // Amoxicillin 250mg
  // Get current drug details
  const getRes = await fetch(`http://localhost:5000/api/drugs`);
  if (!getRes.ok) {
    console.error('Failed to fetch drugs list', await getRes.text());
    return;
  }
  const drugs = await getRes.json();
  const drug = drugs.find(d => d.id === drugId);
  if (!drug) {
    console.error('Drug ID not found in inventory');
    return;
  }

  console.log('Original Drug:', drug);

  // Send PUT update
  const payload = {
    ...drug,
    stock: 90 // update stock from 85 to 90
  };

  const putRes = await fetch(`http://localhost:5000/api/drugs/${drugId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('PUT Response Status:', putRes.status);
  const text = await putRes.text();
  console.log('PUT Response Body:', text);
}

run().catch(console.error);
