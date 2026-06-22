"""pyinfra inventory — Pixevel production target.

Run deploys with key auth (recommended). Bootstrap the key first (see README),
then NEVER put the password in here.

Usage:
    pyinfra inventory.py deploy.py
"""

production = [
    (
        "195.24.237.131",
        {
            "ssh_user": "root",
            "ssh_key": "~/.ssh/id_ed25519",
            # First-run only, BEFORE the key is installed, you may instead run:
            #   pyinfra --user root --password "<pw>" inventory.py deploy.py
            # but switch to keys immediately and rotate the password.
        },
    ),
]
