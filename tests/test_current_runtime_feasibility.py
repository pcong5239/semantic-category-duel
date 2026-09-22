import json

from gltest.direct import VMContext, create_address, deploy_contract


def test_current_runtime_executes_exact_contract_and_independent_validator():
    vm = VMContext()
    vm.check_pickling = True
    alice = create_address("probe-alice")
    bob = create_address("probe-bob")
    observer = create_address("probe-observer")
    vm.sender = alice
    with vm.activate():
        contract = deploy_contract("contracts/main.py", vm)
        contract.create_game("fe" * 16, bob, "ANIMAL", "a")
        vm.sender = bob
        contract.join_game(1, 1)
        vm.sender = alice
        contract.play_word(1, "ant", 0, 2)
        vm.mock_llm("Classify whether", json.dumps('{"v":1,"label":"IN_CATEGORY"}'))
        vm.sender = observer
        contract.evaluate_move(1, 3)
        assert json.loads(contract.get_case(1))["domain"]["score_a"] == 1
        vm.clear_mocks()
        vm.mock_llm("Classify whether", json.dumps('{"v":1,"label":"OUT_OF_CATEGORY"}'))
        assert vm.run_validator(leader_result={"v": 1, "label": "IN_CATEGORY"}) is False
