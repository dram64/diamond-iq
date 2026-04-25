###############################################################################
# Single-table design for game data.
#
# PK pattern: "GAME#<yyyy-mm-dd>"
# SK pattern: "GAME#<game_pk>"
# TTL attribute: "ttl" (Unix epoch seconds, ~7 days from write)
###############################################################################

resource "aws_dynamodb_table" "games" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}
