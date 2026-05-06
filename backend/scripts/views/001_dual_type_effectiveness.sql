CREATE OR REPLACE VIEW dual_type_effectiveness AS
SELECT
    tc1.attacker_type_id,
    tc1.defender_type_id AS defender_type1_id,
    tc2.defender_type_id AS defender_type2_id,
    CASE
        WHEN tc1.defender_type_id = tc2.defender_type_id THEN tc1.multiplier
        ELSE tc1.multiplier * tc2.multiplier
    END AS multiplier
FROM type_chart tc1
JOIN type_chart tc2 ON tc1.attacker_type_id = tc2.attacker_type_id;
