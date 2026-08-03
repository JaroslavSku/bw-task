terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "my_ip" {
  description = "Verejna IP spravce pro SSH pristup, zjistis pres `curl ifconfig.me`"
  type        = string
}

variable "ssh_key_name" {
  type    = string
  default = "jaroslav-laptop"
}

variable "domain" {
  description = "Verejna domena aplikace, napr. taskmaster.sportagio.app. Caddy pro ni sam vyzada TLS certifikat."
  type        = string
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret musi mit alespon 32 znaku."
  }
}

provider "hcloud" {
  token = var.hcloud_token
}
