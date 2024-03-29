#!/bin/sh

set -e

export PROJECT_ID="clinq-services"
export GITHUB_SHA=$(git rev-parse --short HEAD)
export APP="clinq-bridge-google"
export IMAGE="eu.gcr.io/$PROJECT_ID/$APP:latest"
export DOMAIN="google.bridge.clinq.com"
export GOOGLE_SECRET_NAME=" clinq-bridge-google"
export REDIRECT_URI="https://$DOMAIN/oauth2/callback"

kubectl kustomize k8s/template | envsubst > k8s/prod.yml
kubectl apply -f k8s/prod.yml
