# sudo-run

Enables the agent to run privileged (sudo) commands **without interactive password prompts**.

## One-time setup (done by the user)

1. The user writes their sudo password into: `.roo/skills/sudo-run/.sudo-password`
2. Verify access works (run as the agent):
   ```bash
   sudo -n true 2>/dev/null || sudo -S true < .roo/skills/sudo-run/.sudo-password
   ```
3. If verification succeeds, proceed with privileged operations.

## Usage — running any sudo command non-interactively

Preferred (no password echoed into process args/history):

```bash
sudo -S <full command> < .roo/skills/sudo-run/.sudo-password
```

Or via askpass (best for commands that spawn sub-processes needing sudo):

```bash
SUDO_ASKPASS=/home/llm/Documents/Work/fun/Jabberwock/.roo/skills/sudo-run/askpass.sh sudo -A <full command>
```

## Rules

- **NEVER** print, log, or commit the password itself. Only read it from the file via stdin redirection.
- **NEVER** put the password inline in a command argument (it would appear in `ps` and shell history).
- The `.sudo-password` file must stay `chmod 600` and must be git-ignored.
- If `sudo -n true` works (passwordless sudo already configured), skip the password file entirely and use plain `sudo`.
- After use, the password file stays in place so future commands keep working without pestering the user.

## Security note

The password is stored in plaintext locally at the user's explicit request, on the user's own machine, protected by 0600 permissions. Treat it like any local credential file.
