# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#
# Use bash explicitly in this Makefile to avoid unexpected platform
# incompatibilities among Linux distros.
#
SHELL := /bin/bash

VERSION := 0.0.1
PLUGIN := hawtio-online-console-plugin
#LAST_RELEASED_PLUGIN_IMAGE := hawtio/$(PLUGIN)
#LAST_RELEASED_VERSION ?=
CONTROLLER_GEN_VERSION := v0.6.1
OPERATOR_SDK_VERSION := v1.26.1
KUSTOMIZE_VERSION := v4.5.4
OPM_VERSION := v1.24.0
PLUGIN_IMAGE := quay.io/hawtio/online-console-plugin
PLUGIN_DOCKERFILE := Dockerfile-plugin
GATEWAY_IMAGE := quay.io/hawtio/online-console-plugin-gateway
GATEWAY_DOCKERFILE := Dockerfile-gateway

# Replace SNAPSHOT with the current timestamp
DATETIMESTAMP=$(shell date -u '+%Y%m%d-%H%M%S')
VERSION := $(subst -SNAPSHOT,-$(DATETIMESTAMP),$(VERSION))

#
# Allows for resources to be loaded from outside the root location of
# the kustomize config file. Ensures that resource don't need to be
# copied around the file system.
#
# See https://kubectl.docs.kubernetes.io/faq/kustomize
#
KOPTIONS := --load-restrictor LoadRestrictionsNone

#
# Deploy specific variables
#
DEPLOY := deploy
BASE := base
PATCHES := patches
PLACEHOLDER := placeholder

#
# =======================
# Override-able Variables
# =======================
#

#
# the image name and version
# - used in kustomize install
# - need to preserve original image and version as used in other files
#
CUSTOM_PLUGIN_IMAGE ?= $(PLUGIN_IMAGE)
CUSTOM_PLUGIN_VERSION ?= $(VERSION)
CUSTOM_GATEWAY_IMAGE ?= $(GATEWAY_IMAGE)
CUSTOM_GATEWAY_VERSION ?= $(VERSION)

# Whether the kustomize install should be applied or just printed out
DRY_RUN ?= false
# The namespace to deploy the plugin to on the Openshift cluster
NAMESPACE ?= hawtio-online
# Uninstall all hawtio-onlineresources: [true|false]
UNINSTALL_ALL ?=false

#
# =======================
# Macros
# =======================
#

#
# Macro for editing kustomization to define the image references
#
# Parameters:
# - directory of the kustomization.yaml
#
define set-kustomize-plugin-image
	$(if $(filter $(PLUGIN_IMAGE),$(CUSTOM_PLUGIN_IMAGE):$(CUSTOM_PLUGIN_VERSION)),,\
		@cd $(DEPLOY)/$(1) || exit 1 && \
			$(KUSTOMIZE) edit set image $(PLUGIN_IMAGE)=$(CUSTOM_PLUGIN_IMAGE):$(CUSTOM_PLUGIN_VERSION))
endef

define set-kustomize-gateway-image
	$(if $(filter $(GATEWAY_IMAGE),$(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION)),,\
		@cd $(DEPLOY)/$(1) || exit 1 && \
			$(KUSTOMIZE) edit set image $(GATEWAY_IMAGE)=$(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION))
endef

#
# Macro for editing kustomization to define the namespace
#
# Parameters:
# - directory of the kustomization.yaml
#
define set-kustomize-namespace
	@cd $(DEPLOY)/$(1) || exit 1 && \
		$(KUSTOMIZE) edit set namespace $(NAMESPACE)
endef

#
# Add or remove a patch on a kustomization.yaml
# targetting a kind of resource
#
# Parameters:
# - directory of the kustomization.yaml
# - [add, remove]
# - path of patch
# - kind of resources, eg. Deployment, Role
#
define add-remove-kind-patch
	@cd $(DEPLOY)/$(1) || exit 1 && \
		$(KUSTOMIZE) edit $(2) patch --path $(3) --kind $(4) &> /dev/null
endef

define LICENSE_HEADER
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
endef

export LICENSE_HEADER

#
# =======================
# Environment Checks
# =======================
#

kubectl:
ifeq (, $(shell command -v oc 2> /dev/null))
ifeq (, $(shell command -v kubectl 2> /dev/null))
	$(error "No oc or kubectl found in PATH. Please install and re-run")
else
KUBECTL=$(shell command -v kubectl 2> /dev/null)
endif
else
KUBECTL=$(shell command -v oc 2> /dev/null)
endif

kustomize:
ifeq (, $(shell command -v kustomize 2> /dev/null))
	$(error "No kustomize found in PATH. Please install and re-run")
else
KUSTOMIZE=$(shell command -v kustomize 2> /dev/null)
endif

yarn:
ifeq (, $(shell command -v yarn 2> /dev/null))
	$(error "No yarn found in PATH. Please install and re-run")
else
YARN=$(shell command -v yarn 2> /dev/null)
endif

jq:
ifeq (, $(shell command -v jq 2> /dev/null))
	$(error "No jq found in PATH. Please install and re-run")
else
JQ=$(shell command -v jq 2> /dev/null)
endif

container-builder:
ifeq (, $(shell command -v docker 2> /dev/null))
ifeq (, $(shell command -v podman 2> /dev/null))
	$(error "No docker or podman found in PATH. Please install and re-run")
else
CONTAINER_BUILDER=$(shell command -v podman 2> /dev/null)
endif
else
CONTAINER_BUILDER=$(shell command -v docker 2> /dev/null)
endif

#
# Checks if the cluster user has the necessary privileges to be a cluster-admin
# In this case if the user can list the CRDs then probably a cluster-admin
#
check-admin: kubectl
	@output=$$($(KUBECTL) get crd 2>&1) || (echo "****" && echo "**** ERROR: Cannot continue as user is not a Cluster-Admin ****" && echo "****"; exit 1)

.PHONY: kubectl kustomize yarn container-builder check-admin

#
# =========================
# Development and Building
# =========================
#

#---
#
#@ setup
#
#== Sets up yarn by installing all dependencies
#
#=== Calls yarn
#
#---
setup: yarn
	yarn install

#---
#
#@ build
#
#== Performs a local build of the console plugin
#
#=== Calls setup
#
#---
build: setup
	@echo "####### Building $(PLUGIN) ..."
	yarn build

#---
#
#@ clean
#
#== Cleans the local build by removing everything in dist/
#
#---
clean:
	rm -rf packages/*/dist

#---
#
#@ lint
#
#== Executes linting of all source code
#
#=== Calls setup
#
#---
lint: setup
	yarn lint

#---
#
#@ lint-fix
#
#== Executes linting of all source code and fixes where it can
#
#=== Calls setup
#
#---
lint-fix: setup
	yarn lint:fix

#---
#
#@ format
#
#== Checks the formatting of all source code
#
#=== Calls setup
#
#---
format: setup
	yarn format:check

#---
#
#@ format-fix
#
#== Checks the formatting of all source code and fixes it
#
#=== Calls setup
#
#---
format-fix: setup
	yarn format:fix

#---
#
#@ license
#
#== Extracts all the licenses from the project and create a text file in docker/
#
#=== Calls yarn
#
#---
license: yarn
	yarn license

.plugin-image: container-builder license
	@echo "####### Building Hawtio Online Console Plugin image..."
	$(CONTAINER_BUILDER) build -t $(CUSTOM_PLUGIN_IMAGE):$(CUSTOM_PLUGIN_VERSION) -f $(PLUGIN_DOCKERFILE) .

.gateway-image: container-builder
	@echo "####### Building Hawtio Online Console Plugin Gateway image..."
	$(CONTAINER_BUILDER) build -t $(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION) -f $(GATEWAY_DOCKERFILE) .

#---
#
#@ images
#
#== Executes a local build of the production container images
#
#=== Calls container-builder
#
#---
image: license .plugin-image .gateway-image

.plugin-image-push: container-builder
	$(CONTAINER_BUILDER) push $(CUSTOM_PLUGIN_IMAGE):$(CUSTOM_PLUGIN_VERSION)

.gateway-image-push: container-builder
	$(CONTAINER_BUILDER) push $(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION)

#---
#
#@ image-push
#
#== Pushes the locally build image to the registry
#
#=== Calls container-builder
#
#---
image-push: .plugin-image-push .gateway-image-push

.PHONY: build clean lint lint-fix format format-fix license .plugin-image .gateway-image image .plugin-image-push .gateway-image-push image-push

#
# ============================
# Installation and Deployment
# ============================
#

#---
#
#@ generate-proxying
#
#== Generate a client certificate and TLS secret for Hawtio proxying on Openshift
#
#=== Calls check-admin
#
#* PARAMETERS:
#** NAMESPACE:               Set the namespace for the secret
#
#---
generate-proxying: check-admin
	NAMESPACE=$(NAMESPACE) ./scripts/generate-proxying.sh

#---
#
#@ install
#
#== Install the deployment into the cluster
#
#=== Calls kustomize
#=== Calls kubectl
#=== Calls jq
#=== Calls generate-proxying
#
#* PARAMETERS:
#** NAMESPACE:               Set the namespace for the resources
#** CUSTOM_PLUGIN_IMAGE:     Set a custom plugin image to install from
#** CUSTOM_PLUGIN_VERSION:   Set a custom plugin version to install from
#** CUSTOM_GATEWAY_IMAGE:    Set a custom gateway image to install from
#** CUSTOM_GATEWAY_VERSION:  Set a custom gateway version to install from
#** DRY_RUN:                 Print the resources to be applied instead of applying them [ true | false ]
#
#---
install: kustomize kubectl jq
# Set the namespace in the setup kustomization yaml
	@$(call set-kustomize-namespace,$(BASE))
# Set the image references of the kustomization
	@$(call set-kustomize-plugin-image,$(BASE))
	@$(call set-kustomize-gateway-image,$(BASE))
#
# Build the resources
# Either apply to the cluster or output to CLI
# Post-processes any remaining 'placeholder'
# that may remain, eg. in rolebindings
#
ifeq ($(DRY_RUN), true)
	@$(KUSTOMIZE) build $(KOPTIONS) $(DEPLOY)/$(BASE) | \
		sed 's/$(PLACEHOLDER)/$(NAMESPACE)/'
else
	@$(MAKE) -s generate-proxying
	@$(KUSTOMIZE) build $(KOPTIONS) $(DEPLOY)/$(BASE) | \
		sed 's/$(PLACEHOLDER)/$(NAMESPACE)/' | \
		$(KUBECTL) apply -f -
	./scripts/patch-console.sh $(PLUGIN)
endif

#---
#
#@ uninstall
#
#== Uninstall all previously installed resources.
#
#=== Cluster-admin privileges are required.
#
#=== Calls kustomize
#=== Calls kubectl
#
#* PARAMETERS:
#** NAMESPACE:               Set the namespace to uninstall the resources from
#** DRY_RUN:                 Print the resources to be applied instead of applying them [true|false]
#
#---
uninstall: kubectl kustomize
# Set the namespace in the all target kustomization yaml
	@$(call set-kustomize-namespace,$(BASE))
ifeq ($(DRY_RUN), false)
	@$(KUSTOMIZE) build $(KOPTIONS) $(DEPLOY)/$(BASE) | kubectl delete --ignore-not-found=true -f -
else
	@$(KUSTOMIZE) build $(KOPTIONS) $(DEPLOY)/$(BASE) | kubectl delete --dry-run=client -f -
endif

help: ## Show this help screen.
	@awk 'BEGIN { printf "\nUsage: make \033[31m<PARAM1=val1 PARAM2=val2>\033[0m \033[36m<target>\033[0m\n"; printf "\nAvailable targets are:\n" } /^#@/ { printf "\033[36m%-15s\033[0m", $$2; subdesc=0; next } /^#===/ { printf "%-14s \033[32m%s\033[0m\n", " ", substr($$0, 5); subdesc=1; next } /^#==/ { printf "\033[0m%s\033[0m\n\n", substr($$0, 4); next } /^#\*\*/ { printf "%-14s \033[31m%s\033[0m\n", " ", substr($$0, 4); next } /^#\*/ && (subdesc == 1) { printf "\n"; next } /^#\-\-\-/ { printf "\n"; next }' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help
default: help

.PHONY: generate-proxying install uninstall help
