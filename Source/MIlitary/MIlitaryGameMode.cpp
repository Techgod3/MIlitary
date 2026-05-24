// Copyright Epic Games, Inc. All Rights Reserved.

#include "MIlitaryGameMode.h"
#include "PlayerAircraft.h"
#include "Kismet/GameplayStatics.h"

AMIlitaryGameMode::AMIlitaryGameMode()
{
	PrimaryActorTick.TickInterval = 0.1f;
}

void AMIlitaryGameMode::BeginPlay()
{
	Super::BeginPlay();

	bMissionActive = true;
	PlayerScore = 0;
	EnemiesDefeated = 0;
	VesselsDestroyed = 0;

	// Spawn enemy forces
	SpawnEnemies();
	SpawnNavalForces();
	SpawnSAMSites();
}

void AMIlitaryGameMode::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!bMissionActive)
	{
		return;
	}

	// Check mission objectives
	if (EnemiesDefeated >= EnemyAircraftCount && VesselsDestroyed >= NavalVesselsCount)
	{
		bMissionActive = false;
		OnMissionComplete();
	}
}

void AMIlitaryGameMode::AddScore(int32 Points)
{
	PlayerScore += Points;
}

void AMIlitaryGameMode::RegisterEnemyDefeated()
{
	EnemiesDefeated++;
}

void AMIlitaryGameMode::RegisterVesselDestroyed()
{
	VesselsDestroyed++;
}

void AMIlitaryGameMode::EndMission(const FString& Reason)
{
	if (!bMissionActive)
	{
		return;
	}

	bMissionActive = false;
	bMissionFailed = true;
	FailureReason = Reason;
	OnMissionFailed(Reason);
}

void AMIlitaryGameMode::SpawnEnemies()
{
	// TODO: Implement enemy spawn logic
	// Spawn AI-controlled fighter aircraft
}

void AMIlitaryGameMode::SpawnNavalForces()
{
	// TODO: Implement naval vessel spawn logic
	// Spawn destroyers, carriers, and support ships
}

void AMIlitaryGameMode::SpawnSAMSites()
{
	// TODO: Implement SAM site spawn logic
	// Spawn surface-to-air missile batteries
}
