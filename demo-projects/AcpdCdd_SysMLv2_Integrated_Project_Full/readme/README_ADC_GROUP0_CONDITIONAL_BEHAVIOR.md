# AcpdCdd_AdcGroup0NewData Conditional Behavior

`02_Input.sysml` models `AcpdCdd_AdcGroup0NewData` with explicit guarded successions so behavior visualizers can render conditional/dotted arrows.

This version also makes the item/data path explicit:

- the ADC sample flows into validation
- the valid branch produces a normalized actual sample
- the invalid branch produces a normalized invalid sample
- both sample branches flow into `CacheNewGroup0Sample`
- the cache/pair state flows through old-cache check, optional flush, cache update, filled-flag update, pair-complete decision, write/reset or keep-partial branch, and final returned updated pair

The checker `tools/check_adc_group0_conditional_behavior.py` now verifies both the conditional guard expressions and the critical typed flows, so the behavior is not only visually branching but also data-connected.
