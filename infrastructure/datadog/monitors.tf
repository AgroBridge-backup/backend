resource "datadog_monitor" "error_rate_high" {
  name               = "[AgroBridge][Staging] High Error Rate Alert"
  type               = "log alert"
  message            = "Error rate is too high (> 10 errors/min). Check logs immediately. @slack-agrobridge-devops"
  query              = "logs(\"service:agrobridge status:error\").index(\"*").rollup(\"count\").last(\"5m\") > 50"
  
  monitor_thresholds {
    critical = 50
    warning  = 25
  }

  tags = ["service:agrobridge", "env:staging", "severity:high"]
}

resource "datadog_monitor" "high_latency" {
  name    = "[AgroBridge][Staging] High Latency Alert"
  type    = "query alert"
  message = "Average latency for critical endpoints is > 1s. @slack-agrobridge-devops"
  query   = "avg(last_5m):avg:logs.duration{service:agrobridge} > 1000"

  monitor_thresholds {
    critical = 1000
    warning  = 500
  }

  tags = ["service:agrobridge", "env:staging", "performance"]
}
