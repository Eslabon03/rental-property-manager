module.exports = {
  apps: [
    {
      name: "rental-api",
      script: "npm",
      args: "run start --workspace=@workspace/api-server",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
