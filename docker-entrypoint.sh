#!/bin/sh
set -eu
mkdir -p /data
chown app:app /data
exec python -c 'import os, pwd, sys
user = pwd.getpwnam("app")
os.setgid(user.pw_gid)
os.setuid(user.pw_uid)
os.execvp(sys.argv[1], sys.argv[1:])' "$@"
