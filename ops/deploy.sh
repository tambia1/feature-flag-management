#!/usr/bin/env bash
# Builds the Docker image, pushes it to ECR, runs migrations and rolls the ECS service.
# Usage: ops/deploy.sh <production|preview> [preview-name]
# Needs: AWS credentials, AWS_REGION, and these repo variables/secrets:
#   ECR_REPOSITORY, ECS_CLUSTER, ECS_SERVICE (production), MIGRATE_TASK_DEFINITION, APP_URL / PREVIEW_URL_TEMPLATE
set -euo pipefail

TARGET="${1:?production or preview}"
NAME="${2:-$TARGET}"
TAG="$(git rev-parse --short HEAD)"

: "${ECR_REPOSITORY:?set ECR_REPOSITORY}" "${ECS_CLUSTER:?set ECS_CLUSTER}"

REGISTRY="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE="${REGISTRY}/${ECR_REPOSITORY}:${NAME}-${TAG}"

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker build -t "$IMAGE" .
docker push "$IMAGE"

# Migrations run once, before the new servers start.
aws ecs run-task --cluster "$ECS_CLUSTER" --task-definition "${MIGRATE_TASK_DEFINITION:?}" \
  --overrides "{\"containerOverrides\":[{\"name\":\"migrate\",\"command\":[\"npx\",\"prisma\",\"migrate\",\"deploy\"]}]}" \
  --launch-type FARGATE --network-configuration "${ECS_NETWORK_CONFIGURATION:?}" > /dev/null

SERVICE="${ECS_SERVICE:-flags-${NAME}}"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$SERVICE" --force-new-deployment > /dev/null
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$SERVICE"

URL="${APP_URL:-${PREVIEW_URL_TEMPLATE//\{name\}/$NAME}}"
echo "url=$URL" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "Deployed $IMAGE to $URL"
