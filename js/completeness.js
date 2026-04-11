// Playground completeness scoring — mirrors the logic in spielplatzkarte.
// Returns 'complete', 'partial', or 'missing'.
//
// complete = has panoramax photo AND name AND at least one of
//            (operator, opening_hours, surface, access != 'yes')
// partial  = at least one criterion but not all three
// missing  = none

export function playgroundCompleteness(props) {
    const hasPhoto = !!(
        props.panoramax ||
        Object.keys(props).some(k => /^panoramax:\d+$/.test(k) && props[k])
    );
    const hasName = !!props.name;
    const hasDetail = !!(
        props.operator ||
        props.opening_hours ||
        props.surface ||
        (props.access && props.access !== 'yes')
    );

    const score = [hasPhoto, hasName, hasDetail].filter(Boolean).length;
    if (score === 3) return 'complete';
    if (score >= 1) return 'partial';
    return 'missing';
}
