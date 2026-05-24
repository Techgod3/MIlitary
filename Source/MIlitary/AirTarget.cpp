// Copyright Epic Games, Inc. All Rights Reserved.

#include "AirTarget.h"
#include "MIlitaryGameMode.h"
#include "Kismet/GameplayStatics.h"

AAirTarget::AAirTarget()
{
	PrimaryActorTick.bCanEverTick = true;

	TargetMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TargetMesh"));
	RootComponent = TargetMesh;
	TargetMesh->SetCollisionEnabled(ECC_QueryAndPhysics);
}

void AAirTarget::BeginPlay()
{
	Super::BeginPlay();

	CurrentHealth = MaxHealth;
}

void AAirTarget::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
}

void AAirTarget::TakeDamage(float DamageAmount)
{
	if (bIsDestroyed)
	{
		return;
	}

	CurrentHealth = FMath::Max(0.0f, CurrentHealth - DamageAmount);

	if (CurrentHealth <= 0.0f)
	{
		DestroyTarget();
	}
}

void AAirTarget::DestroyTarget()
{
	if (bIsDestroyed)
	{
		return;
	}

	bIsDestroyed = true;

	if (AMIlitaryGameMode* GameMode = Cast<AMIlitaryGameMode>(GetWorld()->GetAuthGameMode()))
	{
		GameMode->AddScore(ScoreValue);
	}

	SpawnExplosion();

	OnDestroyed();

	SetLifeSpan(2.0f);
}

void AAirTarget::SpawnExplosion()
{
	// TODO: Implement explosion particle effect and sound
}
