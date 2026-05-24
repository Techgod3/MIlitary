// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MIlitaryGameMode.generated.h"

class APlayerAircraft;

/**
 * Game Mode for Military Flight Simulator
 */
UCLASS()
class MILITARY_API AMIlitaryGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AMIlitaryGameMode();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

	// Gameplay properties
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gameplay")
	int32 EnemyAircraftCount = 12;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gameplay")
	int32 NavalVesselsCount = 8;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gameplay")
	int32 SAMSitesCount = 20;

	// Scoring
	UPROPERTY(BlueprintReadWrite, Category = "Score")
	int32 PlayerScore = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Score")
	int32 EnemiesDefeated = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Score")
	int32 VesselsDestroyed = 0;

	// Game state
	UPROPERTY(BlueprintReadWrite, Category = "GameState")
	bool bMissionActive = false;

	UPROPERTY(BlueprintReadWrite, Category = "GameState")
	bool bMissionFailed = false;

	UPROPERTY(BlueprintReadWrite, Category = "GameState")
	FString FailureReason;

	// Blueprint event for mission complete
	UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category = "Gameplay")
	void OnMissionComplete();

	UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category = "Gameplay")
	void OnMissionFailed(const FString& Reason);

	UFUNCTION(BlueprintCallable, Category = "Gameplay")
	void AddScore(int32 Points);

	UFUNCTION(BlueprintCallable, Category = "Gameplay")
	void RegisterEnemyDefeated();

	UFUNCTION(BlueprintCallable, Category = "Gameplay")
	void RegisterVesselDestroyed();

	UFUNCTION(BlueprintCallable, Category = "Gameplay")
	void EndMission(const FString& Reason);

private:
	UPROPERTY()
	APlayerAircraft* PlayerAircraft;

	void SpawnEnemies();
	void SpawnNavalForces();
	void SpawnSAMSites();
};
