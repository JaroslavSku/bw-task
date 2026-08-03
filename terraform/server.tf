resource "hcloud_server" "taskmaster" {
  name         = "taskmaster"
  server_type  = "cx23"
  image        = "ubuntu-24.04"
  location     = "nbg1"
  ssh_keys     = [var.ssh_key_name]
  firewall_ids = [hcloud_firewall.taskmaster.id]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    postgres_password = var.postgres_password
    jwt_secret        = var.jwt_secret
    domain            = var.domain
  })

  lifecycle {
    ignore_changes  = [user_data]
    prevent_destroy = true
  }
}

output "server_ip" {
  value = hcloud_server.taskmaster.ipv4_address
}
