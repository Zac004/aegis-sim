-- Aegis-Sim launcher: starts the local server (idempotently) and opens the app
-- in the default browser. Double-clickable macOS application.
on run
	set projDir to "/Users/aadithjayakumar/Desktop/WHAT_IF?"
	set pyBin to "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
	set thePort to "8765"
	try
		do shell script "cd " & quoted form of projDir & " && " & ¬
			"(lsof -ti tcp:" & thePort & " | xargs kill -9 >/dev/null 2>&1 || true) && " & ¬
			"nohup " & quoted form of pyBin & " run.py --no-browser --port " & thePort & ¬
			" >/tmp/aegis-sim.log 2>&1 & " & ¬
			"for i in $(seq 1 60); do /usr/bin/nc -z 127.0.0.1 " & thePort & " 2>/dev/null && break; sleep 0.25; done; " & ¬
			"open http://127.0.0.1:" & thePort & "/"
	on error errMsg
		display dialog "Aegis-Sim could not start:" & return & return & errMsg buttons {"OK"} default button "OK" with icon stop
	end try
end run
