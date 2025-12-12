# Backup, Recovery & Business Continuity

> 🇪🇸 **[Leer esto en Español](../es/BACKUP.md)**

> **Executive Summary:** This document outlines our 3-2-1 backup strategy and a formal Business Continuity Plan (BCP) for Severity 1 incidents. The plan is guided by our cultural principle of **Stoic Resilience**, ensuring a calm, orderly, and effective response during a crisis. A mandatory quarterly validation test guarantees our technical readiness and reinforces our antifragile mindset.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Head of Infrastructure & SRE

## 1. Strategy: Resilience & Continuity

*   **Backup Strategy:** We follow the 3-2-1 rule with automated, daily, off-site snapshots of our database, enabling Point-in-Time Recovery to within ~5 minutes of an incident.
*   **Business Continuity Plan (BCP):** In a crisis, we activate a formal BCP led by an Incident Commander. Our response is guided by the principles in our **[Antifragility & Crisis Guide](../strategy/CULTURE_AND_LEADERSHIP.md)**, emphasizing calm, decisive action.

## 2. Recovery Flow

1.  **Declaration:** An incident is declared. The IC assembles the team.
2.  **Assessment & Communication:** The impact is assessed. The Communications Lead begins updating stakeholders via our Statuspage.
3.  **Execution:** The Technical Lead restores the database to a **new** instance.
4.  **Failover:** After validation, traffic is redirected to the restored system.
5.  **Post-Mortem:** A blameless post-mortem is conducted to learn and improve.

## 3. Process Validation Checklist (Quarterly)

*   **[ ] Automated Restoration Test:** A script (see `test-db-restore.sh`) is executed to prove we can restore the latest backup and that the data is valid.
*   **[ ] BCP Drill:** A tabletop exercise simulating a major outage is conducted with the incident response team to ensure all members know their roles and communication protocols.
