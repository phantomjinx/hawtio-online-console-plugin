#!/bin/sh

# Fail on error and undefined vars
set -eu

NGINX="/usr/share/nginx"
NGINX_HTML="${NGINX}/html"

# nginx.conf parameter default values
export NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE="${NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE:-10m}"
export NGINX_CLIENT_BODY_BUFFER_SIZE="${NGINX_CLIENT_BODY_BUFFER_SIZE:-256k}"
export NGINX_PROXY_BUFFERS="${NGINX_PROXY_BUFFERS:-16 128k}"
export OPENSHIFT=true

check_openshift_api() {
  APISERVER="https://${CLUSTER_MASTER:-kubernetes.default.svc}"
  SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
  TOKEN=$(cat ${SERVICEACCOUNT}/token)
  CACERT=${SERVICEACCOUNT}/ca.crt

  STATUS_CODE=$(curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET "${APISERVER}"/apis/apps.openshift.io/v1 --write-out '%{http_code}' --silent --output /dev/null)
  if [ "${STATUS_CODE}" != "200" ]; then
    OPENSHIFT=false
  fi
  echo "OpenShift API: ${OPENSHIFT} - ${STATUS_CODE} ${APISERVER}/apis/apps.openshift.io/v1"
}

check_openshift_api

if [ "${OPENSHIFT}" == "false" ]; then
  echo "Error: This plugin can only be installed on OpenShift."
  exit 1
fi

generate_nginx_gateway_conf() {
  TEMPLATE=${NGINX}/nginx-gateway.conf.template

  # shellcheck disable=SC2016
  envsubst '
    $NGINX_SUBREQUEST_OUTPUT_BUFFER_SIZE
    $NGINX_CLIENT_BODY_BUFFER_SIZE
    $NGINX_PROXY_BUFFERS
    ' < ${TEMPLATE} > /etc/nginx/nginx.conf
}

echo Generating gateway NGINX configuration
generate_nginx_gateway_conf

# shellcheck disable=SC2181
if [ $? = 0 ]; then
  echo Starting NGINX...
  nginx -g 'daemon off;'
else
  echo Failed to configure correctly...
  exit 1
fi
