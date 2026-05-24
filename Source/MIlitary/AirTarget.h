// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AirTarget.generated.h"

/**
 * Base class for all air/sea targets that can be destroyed
 */
UCLASS()
class MILITARY_API AAirTarget : public AActor
{
	GENERATED_BODY()

public:
	AAirTarget();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target")
	float MaxHealth = 100.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Target")
	float CurrentHealth = 100.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target")
	int32 ScoreValue = 100;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target")
	float DetectionRange = 5000.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Target")
	bool bIsDestroyed = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	class UStaticMeshComponent* TargetMesh;

	UFUNCTION(BlueprintCallable, Category = "Target")
	virtual void TakeDamage(float DamageAmount);

	UFUNCTION(BlueprintCallable, Category = "Target")
	virtual void Destroy();

	UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category = "Target")
	void OnDestroyed();

protected:
	virtual void DestroyTarget();
	virtual void SpawnExplosion();
};
