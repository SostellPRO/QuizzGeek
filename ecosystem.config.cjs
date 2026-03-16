module.exports = {
  apps: [
    {
      name: "quizrealtimeprod",
      cwd: "/home/havelsoftware-quizzwegeek/QuizzGeek/app/quizrealtimeprod/server",
      script: "src/index.js",
      env: { PORT: "4000", HOST: "127.0.0.1", NODE_ENV: "production" }
    },
    {
      name: "quizrealtimetest",
      cwd: "/home/havelsoftware-quizzwegeek/QuizzGeek/app/quizrealtimetest/server",
      script: "src/index.js",
      env: { PORT: "4030", HOST: "127.0.0.1", NODE_ENV: "production" }
    },
    {
      name: "quizliveprod",
      cwd: "/home/havelsoftware-quizzwegeek/QuizzGeek/app/quizliveprod/server",
      script: "src/index.js",
      env: { PORT: "4020", HOST: "127.0.0.1", NODE_ENV: "production" }
    }
  ]
};
