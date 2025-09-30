# DVL App — Student Starter

## Prerequisites
- Install Docker Desktop (Mac or Windows). On Windows, ensure WSL2 is enabled.

## Run
git clone https://github.com/cns-iu/dvl-llm.git
cd dvl-llm
git checkout student-setup
cp .env.example .env          # optional: edit ports if needed
docker compose pull           # fetch prebuilt images
docker compose up -d          # start in background

## Stop
docker compose down
