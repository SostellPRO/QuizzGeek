// PM2 Ecosystem — QuizzGeek
// Chaque app écoute sur un port différent, Nginx reverse-proxy dessus.
// Pour appliquer : pm2 start ecosystem.config.js  (ou pm2 reload ecosystem.config.js)

module.exports = {
  apps: [
    {
      name: "quizrealtimeprod",
      cwd: "./quizrealtimeprod/server",
      script: "src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      watch: false,
      max_memory_restart: "300M",
    },
    {
      name: "quizrealtimetest",
      cwd: "./quizrealtimetest/server",
      script: "src/index.js",
      env: {
        NODE_ENV: "development",
        PORT: 4030,
      },
      watch: false,
      max_memory_restart: "300M",
    },
    {
      name: "quizliveprod",
      cwd: "./quizliveprod/server",
      script: "src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4020,
      },
      watch: false,
      max_memory_restart: "300M",
    },
  ],
};
