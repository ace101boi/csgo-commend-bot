const serializeError = require("serialize-error");
const Account = require("./account.js");

let started = false;

(async () => {
	process.send({
		type: "ready"
	});

	while (!started) {
		await new Promise(r => setTimeout(r, 1000));
	}
})();

process.on("message", async (msg) => {
	started = true;

	const chunk = msg.chunk;
	const target = msg.toCommend || msg.toReport;
	const serverSteamID = msg.serverSteamID;
	const isReport = msg.isReport;
	const isCommend = msg.isCommend;
	const matchID = msg.matchID;
	const debug = msg.debug || false;

	try {
		let done = 0;

		for (let acc of chunk) {
			process.send({
				type: "logging",
				username: acc.username
			});

			const a = new Account(false, acc.proxy, debug);

			a.on("error", (err) => {
				process.send({
					type: "halfwayError",
					username: a.username,
					error: serializeError(err)
				});

				done += 1;
				a.logOff();
			});

			a.login(acc.username, acc.password, acc.sharedSecret).then(async (hello) => {
				process.send({
					type: "loggedOn",
					username: a.username,
					hello: hello
				});

				if (isCommend) {
					await a.commendPlayer(serverSteamID, target, matchID, acc.commend.friendly, acc.commend.teaching, acc.commend.leader).then((response) => {
						process.send({
							type: "commended",
							username: a.username,
							response: response
						});
					}).catch((err) => {
						process.send({
							type: "commendErr",
							username: a.username,
							error: serializeError(err)
						});
					}).finally(() => {
						a.removeAllListeners("error");
					});
				} else {
					await a.reportPlayer(serverSteamID, target, matchID, acc.report.rpt_aimbot, acc.report.rpt_wallhack, acc.report.rpt_speedhack, acc.report.rpt_teamharm, acc.report.rpt_textabuse).then((response) => {
						process.send({
							type: "reported",
							username: a.username,
							response: response,
							confirmation: response.confirmation_id.toString()
						});
					}).catch((err) => {
						process.send({
							type: "reportErr",
							username: a.username,
							error: serializeError(err)
						});
					}).finally(() => {
						a.removeAllListeners("error");
					});
				}

				a.logOff();
				done += 1;
			}).catch((err) => {
				a.removeAllListeners("error");

				process.send({
					type: "failLogin",
					username: a.username,
					error: serializeError(err)
				});

				a.logOff();
				done += 1;
			});
		}

		while (done < chunk.length) {
			await new Promise(p => setTimeout(p, 500));
		}

		// The process should automatically exit once all bots have disconnected from Steam but it doesn't
		setTimeout(() => {
			process.exit(0);
		}, 5000).unref();
	} catch (err) {
		process.send({
			type: "error",
			username: a.username,
			error: serializeError(err)
		});

		setTimeout(() => {
			process.exit(0);
		}, 5000).unref();
	}
});
