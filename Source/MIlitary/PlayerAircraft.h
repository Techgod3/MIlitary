// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "InputActionValue.h"
#include "PlayerAircraft.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UInputMappingContext;
class UInputAction;
struct FInputActionValue;

/**
 * Player-controlled fighter aircraft
 */
UCLASS()
class MILITARY_API APlayerAircraft : public APawn
{
	GENERATED_BODY()

public:
	APlayerAircraft();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;
	virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;

	// Aircraft components
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Aircraft")
	class UStaticMeshComponent* AircraftMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Aircraft")
	USpringArmComponent* CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Aircraft")
	UCameraComponent* FollowCamera;

	// Flight physics
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float MaxSpeed = 3500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float MinSpeed = 1000.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float CurrentSpeed = 2000.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float Acceleration = 500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float TurnRate = 60.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Flight")
	float RollRate = 80.0f;

	// Aircraft vitals
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aircraft")
	float MaxHealth = 100.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Aircraft")
	float CurrentHealth = 100.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aircraft")
	int32 MaxAmmo = 1200;

	UPROPERTY(BlueprintReadWrite, Category = "Aircraft")
	int32 CurrentAmmo = 1200;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aircraft")
	int32 MaxMissiles = 12;

	UPROPERTY(BlueprintReadWrite, Category = "Aircraft")
	int32 CurrentMissiles = 12;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Aircraft")
	int32 MaxFlares = 6;

	UPROPERTY(BlueprintReadWrite, Category = "Aircraft")
	int32 CurrentFlares = 6;

	// Weapons
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapons")
	float GunCooldown = 0.1f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapons")
	float MissileCooldown = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapons")
	float FlareCooldown = 1.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Weapons")
	class AAirTarget* CurrentTarget;

	// Input system
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputMappingContext* DefaultMappingContext;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputAction* LookAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputAction* MoveAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputAction* FireAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputAction* MissileAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	UInputAction* FlareAction;

	// Flight attitude
	FVector Velocity = FVector::ZeroVector;
	FRotator FlightRotation = FRotator::ZeroRotator;
	float CurrentPitch = 0.0f;
	float CurrentRoll = 0.0f;
	float CurrentYaw = 0.0f;

	// Weapon timers
	float GunFireTimer = 0.0f;
	float MissileFireTimer = 0.0f;
	float FlareDeployTimer = 0.0f;

	// Gameplay
	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	void TakeDamage(float DamageAmount);

	UFUNCTION(BlueprintCallable, Category = "Weapons")
	void FireGun();

	UFUNCTION(BlueprintCallable, Category = "Weapons")
	void FireMissile();

	UFUNCTION(BlueprintCallable, Category = "Weapons")
	void DeployFlare();

	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	void SetTargetAircraft(AAirTarget* Target);

	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	float GetHealthPercentage() const { return CurrentHealth / MaxHealth; }

	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	float GetAmmoPercentage() const { return static_cast<float>(CurrentAmmo) / MaxAmmo; }

	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	int32 GetAltitude() const { return static_cast<int32>(-GetActorLocation().Z); }

	UFUNCTION(BlueprintCallable, Category = "Aircraft")
	int32 GetAirspeed() const { return static_cast<int32>(CurrentSpeed / 28.35f); } // Convert to knots

private:
	// Input callbacks
	void Look(const FInputActionValue& Value);
	void Move(const FInputActionValue& Value);
	void OnFirePressed();
	void OnFireReleased();
	void OnMissilePressed();
	void OnFlarePressed();

	// Flight mechanics
	void UpdateFlightPhysics(float DeltaTime);
	void UpdateWeaponTimers(float DeltaTime);
	void ApplyGravityAndThrust(float DeltaTime);
	void ClampAltitude();

	// Particle effects
	void SpawnMuzzleFlash();
	void SpawnExplosionEffect(const FVector& Location);

	bool bIsGunFiring = false;
};
