import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Stateless Corsair BYOK Gateway running on port ${PORT}`);
  console.log(`🔒 Vault interactions bypassed. Ready for C# orchestrator payloads.`);
});