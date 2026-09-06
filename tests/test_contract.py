import json

import pytest
from gltest.direct import VMContext, create_address, deploy_contract


NONCE = "01" * 16


@pytest.fixture
def game():
    vm = VMContext()
    vm.check_pickling = True
    alice = create_address("alice")
    bob = create_address("bob")
    observer = create_address("observer")
    vm.sender = alice
    with vm.activate():
        contract = deploy_contract("contracts/main.py", vm)
        yield vm, contract, alice, bob, observer


def record(contract, game_id=1):
    return json.loads(contract.get_case(game_id))


def create_and_join(game, category="ANIMAL", letter="a"):
    vm, contract, alice, bob, _ = game
    vm.sender = alice
    assert int(contract.create_game(NONCE, bob, category, letter)) == 1
    vm.sender = bob
    contract.join_game(1, 1)
    return record(contract)


def test_create_replay_views_and_nonce_conflict(game):
    vm, contract, alice, bob, _ = game
    game_id = contract.create_game(NONCE, bob, "ANIMAL", "a")
    assert int(game_id) == 1
    assert int(contract.create_game(NONCE, bob, "ANIMAL", "a")) == 1
    assert int(contract.get_count()) == 1
    assert int(contract.get_id_by_nonce(alice, NONCE)) == 1
    assert json.loads(contract.list_cases(1, 4)) == {"ids": ["1"], "next": "0"}
    assert json.loads(contract.list_actor(bob, 0, 4))["ids"] == ["1"]
    assert contract.get_version(1, 1) == contract.get_case(1)
    assert contract.get_case(2) == "null"
    with vm.expect_revert("NONCE_CONFLICT"):
        contract.create_game(NONCE, bob, "FOOD", "a")


def test_authority_turn_and_stale_revision_are_no_write(game):
    vm, contract, alice, bob, observer = game
    create_and_join(game)
    before = contract.get_case(1)
    vm.sender = bob
    with vm.expect_revert("NOT_AUTHORIZED"):
        contract.play_word(1, "ant", 0, 2)
    vm.sender = alice
    with vm.expect_revert("BAD_TURN"):
        contract.play_word(1, "ant", 1, 2)
    with vm.expect_revert("STALE_REVISION"):
        contract.play_word(1, "ant", 0, 1)
    vm.sender = observer
    with vm.expect_revert("NOT_AUTHORIZED"):
        contract.resign_game(1, 2)
    assert contract.get_case(1) == before


def test_valid_consensus_move_and_independent_validator(game):
    vm, contract, alice, _, observer = game
    create_and_join(game)
    vm.sender = alice
    contract.play_word(1, "ant", 0, 2)
    vm.mock_llm("Classify whether", '{"v":1,"label":"IN_CATEGORY"}')
    vm.sender = observer
    contract.evaluate_move(1, 3)
    current = record(contract)
    assert current["phase"] == "TURN"
    assert current["domain"]["score_a"] == 1
    assert current["domain"]["used"] == ["ant"]
    assert current["domain"]["last_letter"] == "t"
    assert current["domain"]["moves"][0]["result"] == "VALID"
    assert vm.run_validator(leader_result={"v": 1, "label": "IN_CATEGORY"}) is True
    vm.clear_mocks()
    vm.mock_llm("Classify whether", '{"v":1,"label":"OUT_OF_CATEGORY"}')
    assert vm.run_validator(leader_result={"v": 1, "label": "IN_CATEGORY"}) is False


def test_bad_link_precedes_repeat_without_llm(game):
    vm, contract, alice, bob, _ = game
    create_and_join(game)
    vm.sender = alice
    contract.play_word(1, "ant", 0, 2)
    vm.mock_llm("Classify whether", '{"v":1,"label":"IN_CATEGORY"}')
    contract.evaluate_move(1, 3)
    vm.sender = bob
    contract.play_word(1, "ant", 1, 4)
    contract.evaluate_move(1, 5)
    current = record(contract)
    assert current["domain"]["moves"][1]["result"] == "BAD_LINK"
    assert current["domain"]["score_b"] == 0
    assert current["domain"]["turn"] == 2


def test_unknown_retry_exhaustion_and_pass(game):
    vm, contract, alice, _, observer = game
    create_and_join(game)
    vm.sender = alice
    contract.play_word(1, "ant", 0, 2)
    vm.mock_llm("Classify whether", '{"v":1,"label":"UNKNOWN"}')
    vm.sender = observer
    contract.evaluate_move(1, 3)
    assert record(contract)["phase"] == "UNRESOLVED"
    vm.warp("2030-01-01T00:02:00Z")
    contract.retry_move(1, 4)
    vm.warp("2030-01-01T00:04:00Z")
    contract.retry_move(1, 5)
    current = record(contract)
    assert current["phase"] == "EXHAUSTED"
    assert current["accepted_attempts"] == 3
    assert current["domain"]["turn"] == 0
    assert current["domain"]["score_a"] == 0
    vm.sender = alice
    contract.pass_turn(1, 0, 6)
    current = record(contract)
    assert current["phase"] == "TURN"
    assert current["domain"]["moves"][0]["result"] == "PASS"
    assert current["domain"]["turn"] == 1


def test_malformed_result_and_disagreement_do_not_mutate(game):
    vm, contract, alice, _, observer = game
    create_and_join(game)
    vm.sender = alice
    contract.play_word(1, "ant", 0, 2)
    before = contract.get_case(1)
    vm.mock_llm("Classify whether", '{"v":1,"label":"YES"}')
    vm.sender = observer
    with vm.expect_revert("MALFORMED_RESULT"):
        contract.evaluate_move(1, 3)
    assert contract.get_case(1) == before


def test_six_passes_draw_and_revision_capacity_proof(game):
    vm, contract, alice, bob, _ = game
    create_and_join(game)
    revision = 2
    for turn in range(6):
        vm.sender = alice if turn % 2 == 0 else bob
        contract.pass_turn(1, turn, revision)
        revision += 1
    current = record(contract)
    assert current["phase"] == "DONE"
    assert current["outcome"] == "DRAW"
    assert len(current["domain"]["moves"]) == 6
    assert int(current["revision"]) == 8


def test_resign_awards_opponent_without_score(game):
    vm, contract, alice, bob, _ = game
    vm.sender = alice
    contract.create_game(NONCE, bob, "TOOL", "h")
    contract.resign_game(1, 1)
    current = record(contract)
    assert current["outcome"] == "B_WINS"
    assert current["domain"]["score_a"] == current["domain"]["score_b"] == 0


@pytest.mark.parametrize(
    "args,error",
    [
        (("bad", "bob", "ANIMAL", "a"), "BAD_NONCE"),
        ((NONCE, "bob", "OTHER", "a"), "BAD_CATEGORY"),
        ((NONCE, "bob", "ANIMAL", "A"), "BAD_LETTER"),
    ],
)
def test_create_validation(game, args, error):
    vm, contract, _, bob, _ = game
    nonce, _, category, letter = args
    with vm.expect_revert(error):
        contract.create_game(nonce, bob, category, letter)
    assert int(contract.get_count()) == 0
